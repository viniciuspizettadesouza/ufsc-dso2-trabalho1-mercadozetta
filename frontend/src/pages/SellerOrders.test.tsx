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

  it('shows only the signed-in seller items and permitted next action', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          _id: 'order-1',
          status: 'placed',
          items: [
            { productName: 'Coffee', quantity: 2, seller: 'seller-1' },
            { productName: 'Tea', quantity: 1, seller: 'seller-2' },
          ],
        },
      ],
    });

    renderSellerOrders();

    expect(await screen.findByText('Coffee × 2')).toBeInTheDocument();
    expect(screen.queryByText('Tea × 1')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mark as confirmed' }),
    ).toBeInTheDocument();
  });

  it('advances an order through its permitted seller action', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          _id: 'order-1',
          status: 'placed',
          items: [{ productName: 'Coffee', quantity: 1, seller: 'seller-1' }],
        },
      ],
    });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    renderSellerOrders();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as confirmed' }),
    );

    expect(api.patch).toHaveBeenCalledWith('/orders/order-1/status', {
      status: 'confirmed',
    });
    expect(screen.getByText('Status: confirmed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Order order-1 updated to confirmed.',
    );
  });

  it('shows seller-order API errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

    renderSellerOrders();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load seller orders.',
    );
  });
});
