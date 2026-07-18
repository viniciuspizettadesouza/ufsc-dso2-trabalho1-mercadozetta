import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  getUnreadNotificationCount,
  listNotifications,
  type Notification,
  type NotificationList,
  updateNotificationRead,
} from '@/services/notifications';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const notification = {
  _id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'mercadozetta',
  user: '22222222-2222-4222-8222-222222222222',
  message: 'Your order shipped',
  read: false,
  createdAt: '2026-07-18T10:00:00.000Z',
  updatedAt: '2026-07-18T10:00:00.000Z',
} satisfies Notification;
const notifications = {
  items: [notification],
  page: { limit: 20, offset: 40, total: 1, hasMore: false },
} satisfies NotificationList;

describe('notification service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('serializes and loads a paginated notification list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: notifications });

    await expect(
      listNotifications({ userId: 'user-1', limit: 20, offset: 40 }),
    ).resolves.toBe(notifications);

    expect(api.get).toHaveBeenCalledWith('/notifications?limit=20&offset=40');
  });

  it('loads and unwraps the unread notification count', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 3 } });

    await expect(getUnreadNotificationCount()).resolves.toBe(3);

    expect(api.get).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('updates notification read state and returns the server notification', async () => {
    const updated = { ...notification, read: true };
    vi.mocked(api.patch).mockResolvedValue({ data: updated });

    await expect(
      updateNotificationRead(notification._id, { read: true }),
    ).resolves.toBe(updated);

    expect(api.patch).toHaveBeenCalledWith(
      `/notifications/${notification._id}`,
      { read: true },
    );
  });
});
