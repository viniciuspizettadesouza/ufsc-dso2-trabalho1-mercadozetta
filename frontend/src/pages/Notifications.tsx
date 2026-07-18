import { useEffect, useState } from 'react';

import PaginationControls from '@/components/PaginationControls';
import Header from '@/pages/header';
import { firstPage, pageInfo, pageItems, withPage } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

type Notification = {
  _id: string;
  message: string;
  read: boolean;
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(firstPage);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mutationMessage, setMutationMessage] = useState('');
  const [mutationError, setMutationError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      setLoading(true);
      setLoadError('');
      try {
        const response = await api.get(
          withPage(apiRoutes.notifications, offset),
        );
        if (!active) return;
        setNotifications(pageItems<Notification>(response.data));
        setPage(pageInfo<Notification>(response.data));
      } catch {
        if (active) {
          setLoadError('Unable to load notifications.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      active = false;
    };
  }, [offset]);

  async function setNotificationRead(notification: Notification) {
    setPendingId(notification._id);
    setMutationMessage('');
    setMutationError('');
    try {
      const response = await api.patch(
        apiRoutes.notification(notification._id),
        { read: !notification.read },
      );
      setNotifications((current) =>
        current.map((item) =>
          item._id === notification._id ? response.data : item,
        ),
      );
      setMutationMessage('Notification updated.');
    } catch {
      setMutationError('Unable to update the notification.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[980px] px-4 py-8">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="mt-2">Updates for your marketplace activity.</p>

        {loading && <p role="status">Loading notifications...</p>}
        {loadError && <p role="alert">{loadError}</p>}
        {mutationMessage && <p role="status">{mutationMessage}</p>}
        {mutationError && <p role="alert">{mutationError}</p>}

        {!loading && !loadError && notifications.length === 0 && (
          <p className="mt-6">You have no notifications.</p>
        )}

        {notifications.length > 0 && (
          <ul className="mt-6 space-y-2">
            {notifications.map((notification) => (
              <li
                className="rounded border border-solid border-[#ddd] p-3"
                key={notification._id}
              >
                {notification.message}
                <button
                  className="ml-3 cursor-pointer underline disabled:cursor-wait"
                  disabled={pendingId !== null}
                  type="button"
                  onClick={() => void setNotificationRead(notification)}
                >
                  {pendingId === notification._id
                    ? 'Updating...'
                    : `Mark as ${notification.read ? 'unread' : 'read'}`}
                </button>
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          label="Notification pages"
          page={page}
          onPage={setOffset}
        />
      </main>
    </div>
  );
}
