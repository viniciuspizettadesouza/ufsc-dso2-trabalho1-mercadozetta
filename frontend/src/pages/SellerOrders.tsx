import { type FormEvent, useState } from 'react';

import Header from '@/pages/header';
import { useAuth } from '@/auth/AuthContext';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/Button';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import { OrderStatusHistory } from '@/components/OrderStatusHistory';
import { firstPage } from '@/pagination';
import { type OrderListRequest } from '@/serverState/queryKeys';
import {
  type Order,
  type OrderStatus,
  useAdvanceOrder,
  useOrderList,
} from '@/serverState/orders';
import { useSellerOperations } from '@/serverState/sellerOperations';
import type { SellerOperationsRequest } from '@/services/sellerOperations';
import { useBrand } from '@/brands/brandContext';
import { formatMoney } from '@/money';

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

export default function SellerOrders() {
  const { user } = useAuth();
  const sellerId = user?._id ?? 'anonymous';

  return (
    <SellerOrdersPage
      key={sellerId}
      sellerId={sellerId}
      enabled={Boolean(user)}
    />
  );
}

function SellerOrdersPage({
  sellerId,
  enabled,
}: {
  sellerId: string;
  enabled: boolean;
}) {
  const brand = useBrand();
  const [pendingOrder, setPendingOrder] = useState('');
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const [orderRequest, setOrderRequest] = useState<OrderListRequest>(() => ({
    userId: sellerId,
    scope: 'seller',
    limit: null,
    offset: null,
    status: '',
    q: '',
  }));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [operationsRequest, setOperationsRequest] =
    useState<SellerOperationsRequest>(() => ({
      userId: sellerId,
      lowStockThreshold: 5,
      limit: 10,
      offset: 0,
    }));
  const orderQuery = useOrderList(orderRequest, enabled);
  const operationsQuery = useSellerOperations(operationsRequest, enabled);
  const updateOrder = useAdvanceOrder(orderRequest);
  const orders = orderQuery.data?.items ?? [];
  const page = orderQuery.data?.page ?? firstPage;

  async function loadOrders(offset: number) {
    setOrderRequest({
      userId: sellerId,
      scope: 'seller',
      limit: page.limit,
      offset,
      status: orderRequest.status,
      q: orderRequest.q,
    });
  }

  function filterOrders(event: FormEvent) {
    event.preventDefault();
    setOrderRequest({
      userId: sellerId,
      scope: 'seller',
      limit: page.limit,
      offset: 0,
      status,
      q: search.trim(),
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
        {operationsQuery.data && (
          <section aria-labelledby="operations-heading">
            <h2 id="operations-heading">Operations overview</h2>
            <dl>
              <div>
                <dt>Products</dt>
                <dd>{operationsQuery.data.summary.productCount}</dd>
              </div>
              <div>
                <dt>Inventory units</dt>
                <dd>{operationsQuery.data.summary.inventoryUnits}</dd>
              </div>
              <div>
                <dt>Orders</dt>
                <dd>{operationsQuery.data.summary.orderCount}</dd>
              </div>
              <div>
                <dt>Open orders</dt>
                <dd>{operationsQuery.data.summary.openOrderCount}</dd>
              </div>
              <div>
                <dt>Ordered units</dt>
                <dd>{operationsQuery.data.summary.orderedUnits}</dd>
              </div>
              <div>
                <dt>Gross revenue (non-cancelled priced orders)</dt>
                <dd>
                  {formatMoney(
                    operationsQuery.data.summary.grossRevenue,
                    brand.locale,
                    brand.currency,
                  ) ?? brand.copy.catalog.priceUnavailableLabel}
                </dd>
              </div>
              <div>
                <dt>Priced orders</dt>
                <dd>{operationsQuery.data.summary.pricedOrderCount}</dd>
              </div>
              <div>
                <dt>Legacy unpriced orders</dt>
                <dd>{operationsQuery.data.summary.legacyUnpricedOrderCount}</dd>
              </div>
            </dl>
            <h3>Low-stock warnings</h3>
            {operationsQuery.data.lowStockProducts.length ? (
              <ul>
                {operationsQuery.data.lowStockProducts.map((product) => (
                  <li key={product._id}>
                    {product.name}: {product.inventory} remaining
                  </li>
                ))}
              </ul>
            ) : (
              <p>No low-stock products.</p>
            )}
            <h3>Inventory history</h3>
            {operationsQuery.data.inventoryHistory.items.length ? (
              <ul>
                {operationsQuery.data.inventoryHistory.items.map((entry) => (
                  <li key={entry._id}>
                    {entry.productName}: {entry.previousInventory} →{' '}
                    {entry.nextInventory}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No inventory changes recorded.</p>
            )}
            {operationsQuery.data.inventoryHistory.page.total >
              operationsQuery.data.inventoryHistory.page.limit && (
              <PaginationControls
                label="Inventory history pages"
                page={operationsQuery.data.inventoryHistory.page}
                onPage={(offset) =>
                  setOperationsRequest((current) => ({ ...current, offset }))
                }
              />
            )}
          </section>
        )}
        {enabled && operationsQuery.isPending && (
          <p role="status">Loading seller operations...</p>
        )}
        {operationsQuery.isError && !operationsQuery.data && (
          <p role="alert">Unable to load seller operations.</p>
        )}
        <form onSubmit={filterOrders}>
          <label htmlFor="order-search">Search orders</label>
          <input
            id="order-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order ID or product name"
          />
          <label htmlFor="order-status">Status</label>
          <select
            id="order-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OrderStatus | '')
            }
          >
            <option value="">All statuses</option>
            <option value="placed">Placed</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button type="submit" variant="primary">
            Apply filters
          </Button>
        </form>
        <MutationFeedbackMessage feedback={feedback} />
        {enabled && orderQuery.isPending ? (
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
                  <OrderStatusHistory
                    orderId={order._id}
                    entries={order.statusHistory}
                  />
                  <ul>
                    {order.items.map((item) => (
                      <li key={`${order._id}-${item.productName}`}>
                        {item.productName} × {item.quantity}
                        {item.lineSubtotal && (
                          <>
                            {' — '}
                            {formatMoney(
                              item.lineSubtotal,
                              brand.locale,
                              brand.currency,
                            ) ?? brand.copy.catalog.priceUnavailableLabel}
                          </>
                        )}
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
