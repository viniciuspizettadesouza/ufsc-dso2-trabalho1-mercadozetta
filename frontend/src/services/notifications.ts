import type { components } from '@/contracts/api';
import { withPage } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Notification = components['schemas']['Notification'];
export type NotificationList = components['schemas']['NotificationList'];
export type NotificationReadInput =
  components['schemas']['NotificationReadRequest'];
type UnreadNotificationCount = components['schemas']['UnreadNotificationCount'];
export type NotificationListRequest = {
  userId: string;
  limit: number;
  offset: number;
};

export async function listNotifications(
  request: NotificationListRequest,
): Promise<NotificationList> {
  const path = withPage(apiRoutes.notifications, request.offset, request.limit);
  const response = await api.get<NotificationList>(path);
  return response.data;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await api.get<UnreadNotificationCount>(
    apiRoutes.unreadNotificationCount,
  );
  return response.data.count;
}

export async function updateNotificationRead(
  notificationId: string,
  input: NotificationReadInput,
): Promise<Notification> {
  const response = await api.patch<Notification>(
    apiRoutes.notification(notificationId),
    input,
  );
  return response.data;
}
