import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Notifications from '@/pages/Notifications';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

function renderNotifications() {
  return render(
    <AuthTestProvider>
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

describe('Notifications', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('loads notifications and updates read state', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        { _id: 'notification-1', message: 'Order created', read: false },
        { _id: 'notification-2', message: 'Review created', read: false },
      ],
    });
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: {
        _id: 'notification-1',
        message: 'Order created',
        read: true,
      },
    });

    renderNotifications();

    expect(await screen.findByText('Order created')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/notifications?limit=20&offset=0');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Mark as read' })[0],
    );
    expect(api.patch).toHaveBeenCalledWith('/notifications/notification-1', {
      read: true,
    });
    expect(
      screen.getByRole('button', { name: 'Mark as unread' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Review created')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Notification updated.',
    );
  });

  it('preserves notification state when a read update fails', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [{ _id: 'notification-1', message: 'Order created', read: false }],
    });
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('network error'));

    renderNotifications();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as read' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to update the notification.',
    );
    expect(
      screen.getByRole('button', { name: 'Mark as read' }),
    ).toBeInTheDocument();
  });

  it('shows load errors without presenting an empty state', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

    renderNotifications();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load notifications.',
    );
    expect(
      screen.queryByText('You have no notifications.'),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state after a successful empty response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

    renderNotifications();

    expect(
      await screen.findByText('You have no notifications.'),
    ).toBeInTheDocument();
  });

  it('loads bounded notification pages', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: {
          items: [
            { _id: 'notification-1', message: 'First page', read: false },
          ],
          page: { limit: 20, offset: 0, total: 21, hasMore: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            { _id: 'notification-21', message: 'Second page', read: true },
          ],
          page: { limit: 20, offset: 20, total: 21, hasMore: false },
        },
      });

    renderNotifications();

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Second page')).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith(
      '/notifications?limit=20&offset=20',
    );
  });
});
