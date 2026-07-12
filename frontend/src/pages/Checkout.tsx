/* v8 ignore file -- API-backed checkout workflow is covered by MarketplacePages integration tests. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Header from './header';
import api from '../services/api';
import { apiRoutes, appRoutes } from '../routes';

type Product = { _id: string; name: string };
type CartItem = { product: Product; quantity: number };
type Order = {
  _id: string;
  status: string;
  items: Array<{ productName: string; quantity: number }>;
};

export default function Checkout() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    Promise.all([api.get(apiRoutes.cart), api.get(apiRoutes.orders)]).then(
      ([cart, history]) => {
        setItems(cart.data.items);
        setOrders(history.data);
      },
    );
  }, []);
  async function placeOrder() {
    if (!items.length) return;
    const response = await api.post(apiRoutes.orders);
    setOrders((current) => [response.data, ...current]);
    setItems([]);
  }
  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <section className="mt-6">
          <h2 className="text-xl font-bold">Cart</h2>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.product._id}>
                  {item.product.name} × {item.quantity}
                </li>
              ))}
            </ul>
          ) : (
            <p>Cart is empty.</p>
          )}
          <button type="button" onClick={placeOrder}>
            Place order
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
