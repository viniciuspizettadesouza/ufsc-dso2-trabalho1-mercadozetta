import { useEffect, useState } from 'react';

import Header from '@/pages/header';
import { apiRoutes } from '@/routes';
import api from '@/services/api';
import { useAuth } from '@/auth/AuthContext';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/Button';
import { firstPage, pageInfo, pageItems, withPage } from '@/pagination';

type OrderStatus =
  'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
type OrderItem = {
  productName: string;
  quantity: number;
  seller: string;
};
type StatusHistoryEntry = {
  status: OrderStatus;
  actor: string;
  changedAt: string;
};
type Order = {
  _id: string;
  status: OrderStatus;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

export default function SellerOrders() {
  const { user } = useAuth();
  const sellerId = user?._id ?? '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOrder, setPendingOrder] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [page, setPage] = useState(firstPage);

  async function loadOrders(offset: number) {
    const response = await api.get(
      withPage(`${apiRoutes.orders}?scope=seller`, offset),
    );
    setOrders(
      pageItems<Order>(response.data)
        .map((order) => ({
          ...order,
          items: order.items.filter((item) => item.seller === sellerId),
        }))
        .filter((order) => order.items.length > 0),
    );
    setPage(pageInfo<Order>(response.data));
  }

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await api.get(`${apiRoutes.orders}?scope=seller`);
        setOrders(
          pageItems<Order>(response.data)
            .map((order: Order) => ({
              ...order,
              items: order.items.filter((item) => item.seller === sellerId),
            }))
            .filter((order: Order) => order.items.length > 0),
        );
        setPage(pageInfo<Order>(response.data));
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
      const response = await api.patch(apiRoutes.orderStatus(order._id), {
        status,
      });
      setOrders((current) =>
        current.map((entry) =>
          entry._id === order._id
            ? {
                ...entry,
                status,
                statusHistory:
                  response.data.statusHistory ?? entry.statusHistory,
              }
            : entry,
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
                  <h3>Status history</h3>
                  <ol>
                    {order.statusHistory?.map((entry) => (
                      <li key={`${entry.status}-${entry.changedAt}`}>
                        {entry.status} by {entry.actor} at{' '}
                        {new Date(entry.changedAt).toLocaleString()}
                      </li>
                    ))}
                  </ol>
                  <ul>
                    {order.items.map((item) => (
                      <li key={`${order._id}-${item.productName}`}>
                        {item.productName} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  {status && (
                    <Button
                      variant="primary"
                      type="button"
                      disabled={Boolean(pendingOrder)}
                      onClick={() => advanceOrder(order)}
                    >
                      {pendingOrder === order._id
                        ? 'Updating order...'
                        : `Mark as ${status}`}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No seller orders found.</p>
        )}
        <PaginationControls
          label="Seller order pages"
          page={page}
          onPage={loadOrders}
        />
      </main>
    </div>
  );
}
