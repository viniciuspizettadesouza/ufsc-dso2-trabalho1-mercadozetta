/* v8 ignore file -- API-backed checkout workflow is covered by MarketplacePages integration tests. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Header from '@/pages/header';
import api from '@/services/api';
import { apiRoutes, appRoutes } from '@/routes';

type Product = {
  _id: string;
  name: string;
  inventory?: number;
  status?: string;
};
type CartItem = { product: Product; quantity: number };
type Order = {
  _id: string;
  status: string;
  items: Array<{ productName: string; quantity: number }>;
};

export default function Checkout() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [pendingItem, setPendingItem] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  useEffect(() => {
    async function loadCheckout() {
      try {
        const [cart, history] = await Promise.all([
          api.get(apiRoutes.cart),
          api.get(apiRoutes.orders),
        ]);
        setItems(cart.data.items);
        setOrders(history.data);
      } catch {
        setFeedback({
          type: 'error',
          message: 'Unable to load cart and order history.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadCheckout();
  }, []);
  async function placeOrder() {
    if (!items.length) return;
    try {
      setIsPlacingOrder(true);
      setFeedback(null);
      const response = await api.post(apiRoutes.orders);
      setOrders((current) => [response.data, ...current]);
      setItems([]);
      setFeedback({ type: 'success', message: 'Order placed successfully.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to place order.' });
    } finally {
      setIsPlacingOrder(false);
    }
  }

  async function updateQuantity(productId: string, quantity: number) {
    try {
      setPendingItem(productId);
      setFeedback(null);
      await api.put(apiRoutes.cartItems, { productId, quantity });
      setItems((current) =>
        current.map((item) =>
          item.product._id === productId ? { ...item, quantity } : item,
        ),
      );
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
      await api.delete(apiRoutes.cartItem(productId));
      setItems((current) =>
        current.filter((item) => item.product._id !== productId),
      );
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
        {feedback && (
          <p
            className={
              feedback.type === 'error'
                ? 'mt-4 font-bold text-red-600'
                : 'mt-4 font-bold text-green-700'
            }
            role={feedback.type === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        )}
        <section className="mt-6">
          <h2 className="text-xl font-bold">Cart</h2>
          {isLoading ? (
            <p role="status">Loading cart and order history...</p>
          ) : items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.product._id}>
                  <span>{item.product.name} ×</span>{' '}
                  <label>
                    <span className="sr-only">
                      Quantity for {item.product.name}
                    </span>
                    <select
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
                    </select>
                  </label>{' '}
                  <button
                    type="button"
                    disabled={Boolean(pendingItem)}
                    onClick={() => removeItem(item.product._id)}
                  >
                    {pendingItem === item.product._id
                      ? 'Updating item...'
                      : `Remove ${item.product.name}`}
                  </button>
                  {(item.product.status !== 'active' ||
                    (item.product.inventory ?? 0) < item.quantity) && (
                    <span className="font-bold text-red-600"> Unavailable</span>
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
          <button
            type="button"
            disabled={
              isLoading ||
              isPlacingOrder ||
              Boolean(pendingItem) ||
              !items.length ||
              hasUnavailableItems
            }
            onClick={placeOrder}
          >
            {isPlacingOrder ? 'Placing order...' : 'Place order'}
          </button>
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
              </li>
            ))}
          </ul>
        </section>
        <Link to={appRoutes.home}>Back to catalog</Link>
      </main>
    </div>
  );
}
