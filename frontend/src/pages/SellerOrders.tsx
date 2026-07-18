import { useState } from 'react';

import Header from '@/pages/header';
import { useAuth } from '@/auth/AuthContext';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/Button';
import { firstPage } from '@/pagination';
import { type OrderListRequest } from '@/serverState/queryKeys';
import {
  type Order,
  type OrderStatus,
  useAdvanceOrder,
  useOrderList,
} from '@/serverState/orders';

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

export default function SellerOrders() {
  const { user } = useAuth();
  const sellerId = user?._id ?? 'anonymous';

  return <SellerOrdersPage key={sellerId} sellerId={sellerId} />;
}

function SellerOrdersPage({ sellerId }: { sellerId: string }) {
  const [pendingOrder, setPendingOrder] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [orderRequest, setOrderRequest] = useState<OrderListRequest>(() => ({
    userId: sellerId,
    scope: 'seller',
    limit: null,
    offset: null,
  }));
  const orderQuery = useOrderList(orderRequest);
  const updateOrder = useAdvanceOrder(orderRequest);
  const orders = orderQuery.data?.items ?? [];
  const page = orderQuery.data?.page ?? firstPage;

  async function loadOrders(offset: number) {
    setOrderRequest({
      userId: sellerId,
      scope: 'seller',
      limit: page.limit,
      offset,
    });
  }

  async function advanceOrder(order: Order) {
    const status = nextStatus[order.status];
    if (!status) return;

    try {
      setPendingOrder(order._id);
      setFeedback(null);
      await updateOrder.mutateAsync({
        orderId: order._id,
        status,
      });
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
        {orderQuery.isPending ? (
          <p role="status">Loading seller orders...</p>
        ) : orderQuery.isError &&
          orderQuery.data === undefined &&
          orderRequest.offset === null ? (
          <p role="alert">Unable to load seller orders.</p>
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
