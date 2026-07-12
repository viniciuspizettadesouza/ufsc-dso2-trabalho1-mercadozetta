import { useEffect, useState } from 'react';

import Header from '@/pages/header';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

type OrderStatus =
  'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
type OrderItem = {
  productName: string;
  quantity: number;
  seller: string;
};
type Order = {
  _id: string;
  status: OrderStatus;
  items: OrderItem[];
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

function getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      _id?: string;
    };
    return user._id ?? '';
  } catch {
    return '';
  }
}

export default function SellerOrders() {
  const sellerId = getUserId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOrder, setPendingOrder] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await api.get(apiRoutes.orders);
        setOrders(
          response.data
            .map((order: Order) => ({
              ...order,
              items: order.items.filter((item) => item.seller === sellerId),
            }))
            .filter((order: Order) => order.items.length > 0),
        );
      } catch {
        setFeedback({
          type: 'error',
          message: 'Unable to load seller orders.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, [sellerId]);

  async function advanceOrder(order: Order) {
    const status = nextStatus[order.status];
    if (!status) return;

    try {
      setPendingOrder(order._id);
      setFeedback(null);
      await api.patch(apiRoutes.orderStatus(order._id), { status });
      setOrders((current) =>
        current.map((entry) =>
          entry._id === order._id ? { ...entry, status } : entry,
        ),
      );
      setFeedback({
        type: 'success',
        message: `Order ${order._id} updated to ${status}.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: `Unable to update order ${order._id}.`,
      });
    } finally {
      setPendingOrder('');
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Seller orders</h1>
        {feedback && (
          <p role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </p>
        )}
        {isLoading ? (
          <p role="status">Loading seller orders...</p>
        ) : orders.length ? (
          <ul>
            {orders.map((order) => {
              const status = nextStatus[order.status];
              return (
                <li key={order._id}>
                  <h2>Order {order._id}</h2>
                  <p>Status: {order.status}</p>
                  <ul>
                    {order.items.map((item) => (
                      <li key={`${order._id}-${item.productName}`}>
                        {item.productName} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  {status && (
                    <button
                      type="button"
                      disabled={Boolean(pendingOrder)}
                      onClick={() => advanceOrder(order)}
                    >
                      {pendingOrder === order._id
                        ? 'Updating order...'
                        : `Mark as ${status}`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No seller orders found.</p>
        )}
      </main>
    </div>
  );
}
