import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SellerOrders from '@/pages/SellerOrders';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';
import type { AuthUser } from '@/auth/AuthContext';
import { ServerStateProvider } from '@/serverState/queryClient';
import { paginatedResponse } from '@/test/paginatedResponse';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

function renderSellerOrders(
  user: AuthUser | null = { _id: 'seller-1', username: 'Seller' },
) {
  return render(
    <ServerStateProvider>
      <AuthTestProvider user={user}>
        <MemoryRouter>
          <SellerOrders />
        </MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
  );
}

describe('SellerOrders', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  function mockOrders(data: unknown) {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      if (url.startsWith('/seller/operations')) {
        return {
          data: {
            summary: {
              productCount: 2,
              activeProductCount: 1,
              lowStockProductCount: 1,
              inventoryUnits: 7,
              orderCount: 3,
              openOrderCount: 1,
              orderedUnits: 4,
              pricedOrderCount: 2,
              historicalCurrencyOrderCount: 1,
              legacyUnpricedOrderCount: 1,
              grossRevenue: { currency: 'USD', amountMinor: '3750' },
            },
            lowStockProducts: [
              {
                _id: 'product-1',
                name: 'Coffee',
                inventory: 2,
                status: 'active',
              },
            ],
            inventoryHistory: {
              items: [
                {
                  _id: 'event-1',
                  productName: 'Coffee',
                  previousInventory: 3,
                  nextInventory: 2,
                },
              ],
              page: { limit: 10, offset: 0, total: 1, hasMore: false },
            },
          },
        };
      }
      return { data: paginatedResponse(data as object[]) };
    });
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
          {
            productName: 'Coffee',
            quantity: 2,
            seller: 'seller-1',
            lineSubtotal: { currency: 'EUR', amountMinor: '2500' },
          },
        ],
      },
    ]);

    renderSellerOrders();

    expect(
      await screen.findByText(
        (_content, node) =>
          node?.tagName === 'LI' && node.textContent === 'Coffee × 2 — €25.00',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tea × 1')).not.toBeInTheDocument();
    expect(screen.getByText(/placed by buyer-1 at/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark as confirmed' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Coffee: 2 remaining')).toBeInTheDocument();
    expect(screen.getByText('Coffee: 3 → 2')).toBeInTheDocument();
    expect(screen.getByText('$37.50')).toBeInTheDocument();
    expect(
      screen.getByText('Gross revenue (non-cancelled priced orders)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Priced orders').parentElement).toHaveTextContent(
      '2',
    );
    expect(
      screen.getByText('Historical-currency priced orders').parentElement,
    ).toHaveTextContent('1');
    expect(
      screen.getByText('Legacy unpriced orders').parentElement,
    ).toHaveTextContent('1');

    await userEvent.type(screen.getByLabelText('Search orders'), 'Coffee');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'placed');
    await userEvent.click(
      screen.getByRole('button', { name: 'Apply filters' }),
    );
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/orders?scope=seller&status=placed&q=Coffee&limit=20&offset=0',
      ),
    );
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
        _id: 'order-1',
        status: 'confirmed',
        items: [{ productName: 'Coffee', quantity: 1, seller: 'seller-1' }],
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

    expect(
      await screen.findByText('Unable to load seller orders.'),
    ).toBeInTheDocument();
  });

  it('preserves seller order state when progression fails', async () => {
    mockOrders([
      {
        _id: 'order-1',
        status: 'placed',
        statusHistory: [],
        items: [{ productName: 'Coffee', quantity: 1, seller: 'seller-1' }],
      },
    ]);
    vi.mocked(api.patch).mockRejectedValue(new Error('network error'));

    renderSellerOrders();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as confirmed' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to update order order-1.',
    );
    expect(screen.getByText('Status: placed')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark as confirmed' }),
    ).toBeInTheDocument();
  });

  it('keeps the previous seller page visible while the next page loads', async () => {
    let resolveNextPage!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/notifications/unread-count') {
        return Promise.resolve({ data: { count: 0 } });
      }
      if (url === '/orders?scope=seller') {
        return Promise.resolve({
          data: {
            items: [
              {
                _id: 'order-1',
                status: 'placed',
                statusHistory: [],
                items: [
                  { productName: 'Coffee', quantity: 1, seller: 'seller-1' },
                ],
              },
            ],
            page: { limit: 20, offset: 0, total: 21, hasMore: true },
          },
        });
      }
      return new Promise((resolve) => {
        resolveNextPage = resolve;
      }) as never;
    });

    renderSellerOrders();

    expect(await screen.findByText('Coffee × 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Coffee × 1')).toBeInTheDocument();

    resolveNextPage({
      data: {
        items: [
          {
            _id: 'order-21',
            status: 'confirmed',
            statusHistory: [],
            items: [{ productName: 'Tea', quantity: 1, seller: 'seller-1' }],
          },
        ],
        page: { limit: 20, offset: 20, total: 21, hasMore: false },
      },
    });

    expect(await screen.findByText('Tea × 1')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/orders?scope=seller&limit=20&offset=20',
      ),
    );
  });

  it('does not expose seller items without an in-memory user', async () => {
    mockOrders([
      {
        _id: 'order-1',
        status: 'placed',
        statusHistory: [],
        items: [{ productName: 'Coffee', quantity: 1, seller: 'seller-1' }],
      },
    ]);

    renderSellerOrders(null);

    expect(
      await screen.findByText('No seller orders found.'),
    ).toBeInTheDocument();
  });
});
