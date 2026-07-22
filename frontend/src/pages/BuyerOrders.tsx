import { useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/brands/brandContext';
import { OrderStatusHistory } from '@/components/OrderStatusHistory';
import PaginationControls from '@/components/PaginationControls';
import { formatMoney } from '@/money';
import Header from '@/pages/header';
import { firstPage } from '@/pagination';
import { appRoutes } from '@/routes';
import { useOrderList } from '@/serverState/orders';
import type { OrderListRequest } from '@/serverState/queryKeys';

export default function BuyerOrders() {
  const { user } = useAuth();
  const brand = useBrand();
  const userId = user?._id ?? 'anonymous';
  const [request, setRequest] = useState<OrderListRequest>(() => ({
    userId,
    scope: 'buyer',
    limit: null,
    offset: null,
    status: '',
    q: '',
  }));
  const query = useOrderList(request);
  const orders = query.data?.items ?? [];
  const page = query.data?.page ?? firstPage;

  function loadOrders(offset: number) {
    setRequest({ ...request, limit: page.limit, offset });
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Order history</h1>
        {query.isPending ? (
          <p role="status">Loading order history...</p>
        ) : query.isError && query.data === undefined ? (
          <p role="alert">Unable to load order history.</p>
        ) : orders.length === 0 ? (
          <p>You have not placed any orders yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((order) => (
              <li
                className="rounded-surface border border-theme-border bg-surface p-4 shadow-surface"
                key={order._id}
              >
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
                {order.deliveryAddress && order.deliveryOption && (
                  <div className="mt-2">
                    <strong>Delivery snapshot:</strong>{' '}
                    {order.deliveryAddress.recipientName},{' '}
                    {order.deliveryAddress.line1}, {order.deliveryAddress.city},{' '}
                    {order.deliveryAddress.postalCode},{' '}
                    {order.deliveryAddress.countryCode}.{' '}
                    {order.deliveryOption.label} —{' '}
                    {order.deliveryOption.estimate}
                  </div>
                )}
                <OrderStatusHistory
                  orderId={order._id}
                  entries={order.statusHistory}
                />
              </li>
            ))}
          </ul>
        )}
        <PaginationControls
          label="Order history pages"
          page={page}
          onPage={loadOrders}
        />
        <Link className="mt-6 inline-block" to={appRoutes.home}>
          Back to catalog
        </Link>
      </main>
    </div>
  );
}
