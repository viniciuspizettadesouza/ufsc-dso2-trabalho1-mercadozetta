import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  queryKeys,
  type NotificationListRequest,
} from '@/serverState/queryKeys';
import {
  getUnreadNotificationCount,
  listNotifications,
  updateNotificationRead,
  type Notification,
  type NotificationList,
} from '@/services/notifications';

export type { Notification } from '@/services/notifications';
export type NotificationQueryData = NotificationList;

export const notificationQueries = {
  list: (request: NotificationListRequest) =>
    queryOptions({
      queryKey: queryKeys.notifications.list(request),
      queryFn: () => listNotifications(request),
    }),
  unreadCount: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.notifications.unreadCount(userId),
      queryFn: getUnreadNotificationCount,
    }),
};

export function useNotificationList(request: NotificationListRequest) {
  return useQuery({
    ...notificationQueries.list(request),
    placeholderData: keepPreviousData,
  });
}

export function useUnreadNotificationCount(userId: string, enabled: boolean) {
  return useQuery({
    ...notificationQueries.unreadCount(userId),
    enabled,
  });
}

export function useNotificationReadMutation(
  userId: string,
  request: NotificationListRequest,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      notification,
      read,
    }: {
      notification: Notification;
      read: boolean;
    }) => updateNotificationRead(notification._id, { read }),
    onSuccess: (updated, { notification }) => {
      queryClient.setQueryData<NotificationQueryData>(
        queryKeys.notifications.list(request),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item._id === updated._id ? updated : item,
                ),
              }
            : current,
      );
      const unreadDelta = Number(!updated.read) - Number(!notification.read);
      queryClient.setQueryData<number>(
        queryKeys.notifications.unreadCount(userId),
        (current) =>
          current === undefined ? current : Math.max(0, current + unreadDelta),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.lists(userId),
        refetchType: 'inactive',
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(userId),
        refetchType: 'inactive',
      });
    },
  });
}
