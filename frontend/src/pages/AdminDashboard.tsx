/* v8 ignore file -- demo-local admin dashboard is covered by integration smoke tests. */
import { useEffect, useState } from 'react';

import Header from '@/pages/header';
import api from '@/services/api';
import { apiRoutes } from '@/routes';
import { pageItems } from '@/pagination';

type Product = {
  _id: string;
  name: string;
  status?: string;
  category?: string;
};

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<
    Array<{ _id: string; message: string; read: boolean }>
  >([]);

  async function setNotificationRead(notificationId: string, read: boolean) {
    const response = await api.patch(apiRoutes.notification(notificationId), {
      read,
    });
    setNotifications((current) =>
      current.map((notification) =>
        notification._id === notificationId ? response.data : notification,
      ),
    );
  }

  useEffect(() => {
    async function loadProducts() {
      const [response, notificationResponse] = await Promise.all([
        api.get(apiRoutes.products),
        api.get(apiRoutes.notifications),
      ]);
      setProducts(pageItems<Product>(response.data));
      setNotifications(
        pageItems<{ _id: string; message: string; read: boolean }>(
          notificationResponse.data,
        ),
      );
    }

    loadProducts();
  }, []);

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[980px] px-4 py-8">
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="rounded border border-solid border-[#ddd] p-4">
            <h2 className="font-bold">Products</h2>
            <p className="text-3xl font-bold">{products.length}</p>
          </section>
          <section className="rounded border border-solid border-[#ddd] p-4">
            <h2 className="font-bold">Moderation</h2>
            <p className="text-3xl font-bold">
              {
                products.filter(
                  (product) =>
                    product.status === 'paused' ||
                    product.status === 'archived',
                ).length
              }
            </p>
          </section>
          <section className="rounded border border-solid border-[#ddd] p-4">
            <h2 className="font-bold">Notifications</h2>
            <p className="text-3xl font-bold">{notifications.length}</p>
          </section>
        </div>
        <section className="mt-8">
          <h2 className="text-xl font-bold">Audit log</h2>
          <ul className="mt-3 space-y-2">
            {products.map((product) => (
              <li
                className="rounded border border-solid border-[#ddd] p-3"
                key={product._id}
              >
                Product {product.name} is {product.status || 'active'} in{' '}
                {product.category || 'general'}
              </li>
            ))}
            {notifications.map((notification) => (
              <li
                className="rounded border border-solid border-[#ddd] p-3"
                key={notification._id}
              >
                {notification.message}
                <button
                  className="ml-3 cursor-pointer underline"
                  type="button"
                  onClick={() =>
                    setNotificationRead(notification._id, !notification.read)
                  }
                >
                  Mark as {notification.read ? 'unread' : 'read'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
