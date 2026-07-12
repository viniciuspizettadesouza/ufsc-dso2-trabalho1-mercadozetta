import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SellerOrders from '@/pages/SellerOrders';
import api from '@/services/api';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

function renderSellerOrders() {
  return render(
    <MemoryRouter>
      <SellerOrders />
    </MemoryRouter>,
  );
}

describe('SellerOrders', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'seller-1', username: 'Seller' }),
    );
    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  function mockOrders(data: unknown) {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: url === '/notifications/unread-count' ? { count: 0 } : data,
    }));
  }

  it('shows only the signed-in seller items and permitted next action', async () => {
    mockOrders([
      {
        _id: 'order-1',
        status: 'placed',
        statusHistory: [
          {
            status: 'placed',
            actor: 'buyer-1',
            changedAt: '2026-07-13T10:00:00.000Z',
          },
        ],
        items: [
          { productName: 'Coffee', quantity: 2, seller: 'seller-1' },
          { productName: 'Tea', quantity: 1, seller: 'seller-2' },
        ],
      },
    ]);

    renderSellerOrders();

    expect(await screen.findByText('Coffee × 2')).toBeInTheDocument();
    expect(screen.queryByText('Tea × 1')).not.toBeInTheDocument();
    expect(screen.getByText(/placed by buyer-1 at/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark as confirmed' }),
    ).toBeInTheDocument();
  });

  it('advances an order through its permitted seller action', async () => {
    mockOrders([
      {
        _id: 'order-1',
        status: 'placed',
        statusHistory: [],
        items: [{ productName: 'Coffee', quantity: 1, seller: 'seller-1' }],
      },
    ]);
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: {
        statusHistory: [
          {
            status: 'confirmed',
            actor: 'seller-1',
            changedAt: '2026-07-13T11:00:00.000Z',
          },
        ],
      },
    });

    renderSellerOrders();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as confirmed' }),
    );

    expect(api.patch).toHaveBeenCalledWith('/orders/order-1/status', {
      status: 'confirmed',
    });
    expect(screen.getByText('Status: confirmed')).toBeInTheDocument();
    expect(screen.getByText(/confirmed by seller-1 at/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Order order-1 updated to confirmed.',
    );
  });

  it('shows seller-order API errors', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      throw new Error('network error');
    });

    renderSellerOrders();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load seller orders.',
    );
  });

  it('handles invalid stored user data without exposing seller items', async () => {
    localStorage.setItem('user', '{invalid-json');
    mockOrders([
      {
        _id: 'order-1',
        status: 'placed',
        statusHistory: [],
        items: [{ productName: 'Coffee', quantity: 1, seller: 'seller-1' }],
      },
    ]);

    renderSellerOrders();

    expect(
      await screen.findByText('No seller orders found.'),
    ).toBeInTheDocument();
  });
});
