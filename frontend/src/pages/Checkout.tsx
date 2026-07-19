import { useRef, useState } from 'react';
import { Link } from 'react-router';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import { OrderStatusHistory } from '@/components/OrderStatusHistory';
import { firstPage } from '@/pagination';
import { useAuth } from '@/auth/AuthContext';
import { type OrderListRequest } from '@/serverState/queryKeys';
import { useCreateOrder, useOrderList } from '@/serverState/orders';
import { useDetailedCart } from '@/serverState/cart';
import { createIdempotencyKey } from '@/services/idempotency';
import { useBrand } from '@/brands/brandContext';
import { formatMoney, multiplyMoney, sumMoney } from '@/money';

export default function Checkout() {
  const { user } = useAuth();
  const brand = useBrand();
  const userId = user?._id ?? 'anonymous';
  const [pendingItem, setPendingItem] = useState('');
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const [orderRequest, setOrderRequest] = useState<OrderListRequest>(() => ({
    userId,
    scope: 'buyer',
    limit: null,
    offset: null,
    status: '',
    q: '',
  }));
  const cart = useDetailedCart(userId);
  const orderQuery = useOrderList(orderRequest);
  const createOrder = useCreateOrder(userId, orderRequest);
  const loadError =
    cart.isLoadError ||
    (orderQuery.isError &&
      orderQuery.data === undefined &&
      orderRequest.offset === null);
  const isLoading = cart.isPending || orderQuery.isPending;
  const items = loadError ? [] : cart.items;
  const orders = loadError ? [] : (orderQuery.data?.items ?? []);
  const orderPage = loadError
    ? firstPage
    : (orderQuery.data?.page ?? firstPage);
  const displayedFeedback = loadError
    ? {
        type: 'error' as const,
        message: 'Unable to load cart and order history.',
      }
    : feedback;

  async function loadOrders(offset: number) {
    setOrderRequest({
      userId,
      scope: 'buyer',
      limit: orderPage.limit,
      offset,
      status: '',
      q: '',
    });
  }

  async function placeOrder() {
    if (!items.length) return;
    try {
      setFeedback(null);
      checkoutIdempotencyKey.current ??= createIdempotencyKey();
      await createOrder.mutateAsync(checkoutIdempotencyKey.current);
      checkoutIdempotencyKey.current = null;
      setFeedback({ type: 'success', message: 'Order placed successfully.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to place order.' });
    }
  }

  async function updateQuantity(productId: string, quantity: number) {
    try {
      setPendingItem(productId);
      setFeedback(null);
      await cart.updateQuantity({ productId, quantity });
      checkoutIdempotencyKey.current = null;
      setFeedback({ type: 'success', message: 'Cart quantity updated.' });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Unable to update cart quantity.',
      });
    } finally {
      setPendingItem('');
    }
  }

  async function removeItem(productId: string) {
    try {
      setPendingItem(productId);
      setFeedback(null);
      await cart.removeItem(productId);
      checkoutIdempotencyKey.current = null;
      setFeedback({ type: 'success', message: 'Item removed from cart.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to remove cart item.' });
    } finally {
      setPendingItem('');
    }
  }

  const quotedLines = items.map((item) =>
    multiplyMoney(item.product.price, item.quantity, brand.currency),
  );
  const quotedTotal = sumMoney(quotedLines, brand.currency);
  const hasUnavailableItems =
    items.some(
      (item, index) =>
        item.product.status !== 'active' ||
        (item.product.inventory ?? 0) < item.quantity ||
        !item.product.price ||
        item.product.price.currency !== brand.currency ||
        !quotedLines[index],
    ) ||
    (items.length > 0 && !quotedTotal);
  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <MutationFeedbackMessage
          className="mt-4"
          feedback={displayedFeedback}
        />
        <section className="mt-6">
          <h2 className="text-xl font-bold">Cart</h2>
          {isLoading ? (
            <p role="status">Loading cart and order history...</p>
          ) : !loadError && items.length ? (
            <ul>
              {items.map((item, index) => (
                <li key={item.product._id}>
                  <span>{item.product.name} ×</span>{' '}
                  <label>
                    <span className="sr-only">
                      Quantity for {item.product.name}
                    </span>
                    <Select
                      aria-label={`Quantity for ${item.product.name}`}
                      disabled={Boolean(pendingItem)}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(
                          item.product._id,
                          Number(event.target.value),
                        )
                      }
                    >
                      {Array.from(
                        { length: Math.max(item.product.inventory ?? 1, 1) },
                        (_, index) => index + 1,
                      ).map((quantity) => (
                        <option key={quantity} value={quantity}>
                          {quantity}
                        </option>
                      ))}
                    </Select>
                  </label>{' '}
                  <span>
                    {formatMoney(
                      item.product.price,
                      brand.locale,
                      brand.currency,
                    ) ?? brand.copy.catalog.priceUnavailableLabel}
                    {' each; '}
                    {formatMoney(
                      quotedLines[index],
                      brand.locale,
                      brand.currency,
                    ) ?? brand.copy.catalog.priceUnavailableLabel}
                    {' quoted subtotal'}
                  </span>{' '}
                  <Button
                    type="button"
                    disabled={Boolean(pendingItem)}
                    onClick={() => removeItem(item.product._id)}
                  >
                    {pendingItem === item.product._id
                      ? 'Updating item...'
                      : `Remove ${item.product.name}`}
                  </Button>
                  {(item.product.status !== 'active' ||
                    (item.product.inventory ?? 0) < item.quantity ||
                    !quotedLines[index]) && (
                    <span className="font-bold text-red-700"> Unavailable</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Cart is empty.</p>
          )}
          {items.length > 0 && quotedTotal && (
            <p>
              Current cart quote:{' '}
              <strong>
                {formatMoney(quotedTotal, brand.locale, brand.currency)}
              </strong>
            </p>
          )}
          {hasUnavailableItems && (
            <p role="alert">
              Update or remove unavailable items before placing your order.
            </p>
          )}
          <Button
            variant="primary"
            type="button"
            disabled={
              isLoading ||
              loadError ||
              createOrder.isPending ||
              Boolean(pendingItem) ||
              !items.length ||
              hasUnavailableItems
            }
            onClick={placeOrder}
          >
            {createOrder.isPending ? 'Placing order...' : 'Place order'}
          </Button>
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-bold">Order history</h2>
          <ul>
            {orders.map((order) => (
              <li key={order._id}>
                <strong>{order._id}</strong> ({order.status}) -{' '}
                {order.items
                  .map((item) => {
                    const subtotal = formatMoney(
                      item.lineSubtotal,
                      brand.locale,
                      item.lineSubtotal?.currency ?? brand.currency,
                    );
                    return `${item.productName} × ${item.quantity}${subtotal ? ` — ${subtotal}` : ''}`;
                  })
                  .join(', ')}
                {' — '}
                {order.pricingState === 'priced'
                  ? `Total: ${formatMoney(order.total, brand.locale, order.total?.currency ?? brand.currency) ?? brand.copy.catalog.priceUnavailableLabel}`
                  : 'Legacy order — price unavailable'}
                <OrderStatusHistory
                  orderId={order._id}
                  entries={order.statusHistory}
                />
              </li>
            ))}
          </ul>
          <PaginationControls
            label="Order history pages"
            page={orderPage}
            onPage={loadOrders}
          />
        </section>
        <Link to={appRoutes.home}>Back to catalog</Link>
      </main>
    </div>
  );
}
