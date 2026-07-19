import { useState } from 'react';
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

export default function Checkout() {
  const { user } = useAuth();
  const userId = user?._id ?? 'anonymous';
  const [pendingItem, setPendingItem] = useState('');
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const [orderRequest, setOrderRequest] = useState<OrderListRequest>(() => ({
    userId,
    scope: 'buyer',
    limit: null,
    offset: null,
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
    });
  }

  async function placeOrder() {
    if (!items.length) return;
    try {
      setFeedback(null);
      await createOrder.mutateAsync();
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
      setFeedback({ type: 'success', message: 'Item removed from cart.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to remove cart item.' });
    } finally {
      setPendingItem('');
    }
  }

  const hasUnavailableItems = items.some(
    (item) =>
      item.product.status !== 'active' ||
      (item.product.inventory ?? 0) < item.quantity,
  );
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
              {items.map((item) => (
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
                    (item.product.inventory ?? 0) < item.quantity) && (
                    <span className="font-bold text-red-700"> Unavailable</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Cart is empty.</p>
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
                  .map((item) => `${item.productName} × ${item.quantity}`)
                  .join(', ')}
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
