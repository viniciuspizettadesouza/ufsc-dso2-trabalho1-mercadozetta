export type CreateNotification = {
  tenantId: string;
  userId: string;
  message: string;
};

export type NotificationRecord = {
  _id: string;
  tenantId: string;
  user: string;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface NotificationRepository {
  create(notification: CreateNotification, now: Date): Promise<void>;
  createMany(notifications: CreateNotification[], now: Date): Promise<void>;
  list(
    tenantId: string,
    userId: string,
    pagination: Pagination,
  ): Promise<Paginated<NotificationRecord>>;
  countUnread(tenantId: string, userId: string): Promise<number>;
  updateRead(
    tenantId: string,
    userId: string,
    notificationId: string,
    read: boolean,
  ): Promise<NotificationRecord | null>;
}
import type { Paginated, Pagination } from '@/pagination';
