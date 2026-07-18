import { useState } from 'react';

import PaginationControls from '@/components/PaginationControls';
import Header from '@/pages/header';
import { firstPage } from '@/pagination';
import { Button } from '@/components/Button';
import { useAuth } from '@/auth/AuthContext';
import type { NotificationListRequest } from '@/serverState/queryKeys';
import {
  type Notification,
  useNotificationList,
  useNotificationReadMutation,
} from '@/serverState/notifications';

export default function Notifications() {
  const { user } = useAuth();
  const userId = user?._id ?? 'anonymous';
  const [request, setRequest] = useState<NotificationListRequest>(() => ({
    userId,
    limit: firstPage.limit,
    offset: firstPage.offset,
  }));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mutationMessage, setMutationMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const notificationsQuery = useNotificationList(request);
  const readMutation = useNotificationReadMutation(userId, request);
  const notifications = notificationsQuery.data?.items ?? [];
  const page = notificationsQuery.data?.page ?? firstPage;
  const loading = notificationsQuery.isPending;
  const loadError = notificationsQuery.isError;

  async function setNotificationRead(notification: Notification) {
    setPendingId(notification._id);
    setMutationMessage('');
    setMutationError('');
    try {
      await readMutation.mutateAsync({
        notification,
        read: !notification.read,
      });
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
        {loadError && <p role="alert">Unable to load notifications.</p>}
        {mutationMessage && <p role="status">{mutationMessage}</p>}
        {mutationError && <p role="alert">{mutationError}</p>}

        {!loading && !loadError && notifications.length === 0 && (
          <p className="mt-6">You have no notifications.</p>
        )}

        {notifications.length > 0 && (
          <ul className="mt-6 space-y-2">
            {notifications.map((notification) => (
              <li
                className="rounded-surface border border-solid border-theme-border bg-surface p-3 shadow-surface"
                key={notification._id}
              >
                {notification.message}
                <Button
                  className="ml-3 cursor-pointer underline disabled:cursor-wait"
                  disabled={pendingId !== null}
                  type="button"
                  onClick={() => void setNotificationRead(notification)}
                >
                  {pendingId === notification._id
                    ? 'Updating...'
                    : `Mark as ${notification.read ? 'unread' : 'read'}`}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          label="Notification pages"
          page={page}
          onPage={(offset) => setRequest({ userId, limit: page.limit, offset })}
        />
      </main>
    </div>
  );
}
