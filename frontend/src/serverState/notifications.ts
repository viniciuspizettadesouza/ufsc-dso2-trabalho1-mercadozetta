import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { pageInfo, pageItems, withPage, type PageInfo } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';
import {
  queryKeys,
  type NotificationListRequest,
} from '@/serverState/queryKeys';

export type Notification = {
  _id: string;
  message: string;
  read: boolean;
};
export type NotificationQueryData = {
  items: Notification[];
  page: PageInfo;
};

export const notificationQueries = {
  list: (request: NotificationListRequest) =>
    queryOptions({
      queryKey: queryKeys.notifications.list(request),
      queryFn: async () => {
        const response = await api.get(
          withPage(apiRoutes.notifications, request.offset, request.limit),
        );
        return {
          items: pageItems<Notification>(response.data),
          page: pageInfo<Notification>(response.data),
        };
      },
    }),
  unreadCount: (userId: string) =>
    queryOptions({
      queryKey: queryKeys.notifications.unreadCount(userId),
      queryFn: async () => {
        const response = await api.get(apiRoutes.unreadNotificationCount);
        return response.data.count as number;
      },
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
    }) => {
      const response = await api.patch(
        apiRoutes.notification(notification._id),
        { read },
      );
      return response.data as Notification;
    },
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
