import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Checkout from '@/pages/Checkout';
import ProductDetail from '@/pages/ProductDetail';
import SellerProfile from '@/pages/SellerProfile';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';
import type { AuthUser } from '@/auth/AuthContext';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const product = {
  _id: 'product-1',
  name: 'Coffee',
  description: 'Fresh beans',
  image: 'coffee.jpg',
  category: 'drinks',
  subcategory: 'beans',
  inventory: 3,
  status: 'active' as const,
  seller: 'seller-1',
  sellerProfile: {
    _id: 'seller-1',
    username: 'Seller',
    telephone: '123',
    email: 'seller@example.com',
    storeName: 'Seller store',
  },
};

function renderAt(
  route: string,
  path: string,
  element: React.ReactNode,
  user: AuthUser | null = null,
) {
  return render(
    <AuthTestProvider user={user}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

describe('marketplace pages', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.delete).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('loads product details and records watchlist, cart, review, and notifications', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/products/product-1') return { data: product };
      if (url === '/cart') return { data: { items: [] } };
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: [] };
    });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({
      data: { _id: 'review-1', rating: 5, comment: 'Great beans' },
    });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />, {
      _id: 'user-1',
    });

    expect(
      await screen.findByRole('heading', { name: 'Coffee' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Watch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    await userEvent.type(screen.getByLabelText('Review'), 'Great beans');
    await userEvent.click(screen.getByRole('button', { name: 'Add review' }));

    expect(api.put).toHaveBeenCalledWith('/watchlist/product-1');
    expect(api.put).toHaveBeenCalledWith('/cart/items', {
      productId: 'product-1',
      quantity: 1,
    });
    expect(screen.getByText(/Great beans/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/products/product-1/reviews', {
      rating: 5,
      comment: 'Great beans',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Review added.');
  });

  it('shows errors when product commerce actions fail', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: product })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.put).mockRejectedValue(new Error('network error'));
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

    await screen.findByRole('heading', { name: 'Coffee' });
    await userEvent.click(screen.getByRole('button', { name: 'Watch' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to update watchlist.',
    );

    await userEvent.type(screen.getByLabelText('Review'), 'Great beans');
    await userEvent.click(screen.getByRole('button', { name: 'Add review' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to add review.',
    );
    expect(screen.getByLabelText('Review')).toHaveValue('Great beans');
  });

  it('shows product detail load errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load product.',
    );
  });

  it('checks out persisted cart items and refreshes order history', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [{ product, quantity: 1 }] } })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        _id: 'order-1',
        status: 'placed',
        items: [{ productName: 'Coffee', quantity: 1 }],
        statusHistory: [
          {
            status: 'placed',
            actor: 'buyer-1',
            changedAt: '2026-07-13T10:00:00.000Z',
          },
        ],
      },
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByLabelText('Quantity for Coffee')).toHaveValue(
      '1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() =>
      expect(screen.getByText(/order-1/)).toBeInTheDocument(),
    );
    expect(api.post).toHaveBeenCalledWith('/orders');
    expect(screen.getByText(/placed by buyer-1 at/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Order placed successfully.',
    );
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
  });

  it('shows checkout loading and order API errors', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [{ product, quantity: 1 }] } })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.post).mockRejectedValueOnce(new Error('network error'));

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading cart and order history...',
    );
    await screen.findByLabelText('Quantity for Coffee');
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to place order.',
    );
    expect(screen.getByLabelText('Quantity for Coffee')).toHaveValue('1');
  });

  it('shows checkout load errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load cart and order history.',
    );
  });

  it('updates quantities and removes checkout items', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [{ product, quantity: 1 }] } })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} });
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} });

    renderAt('/checkout', '/checkout', <Checkout />);

    const quantity = await screen.findByLabelText('Quantity for Coffee');
    await userEvent.selectOptions(quantity, '2');
    expect(api.put).toHaveBeenCalledWith('/cart/items', {
      productId: 'product-1',
      quantity: 2,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cart quantity updated.',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Coffee' }),
    );
    expect(api.delete).toHaveBeenCalledWith('/cart/items/product-1');
    expect(screen.getByText('Cart is empty.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Item removed from cart.',
    );
  });

  it('disables checkout when a cart item is unavailable', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              product: { ...product, inventory: 0, status: 'sold_out' },
              quantity: 1,
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: [] });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Update or remove unavailable items before placing your order.',
    );
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
  });

  it('loads seller profiles with product links', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: product.sellerProfile })
      .mockResolvedValueOnce({ data: [product] });

    renderAt(
      '/sellers/seller-1/profile',
      '/sellers/:sellerId/profile',
      <SellerProfile />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Seller store' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Coffee' })).toHaveAttribute(
      'href',
      '/products/product-1',
    );
  });

  it('shows seller profile load errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

    renderAt(
      '/sellers/seller-1/profile',
      '/sellers/:sellerId/profile',
      <SellerProfile />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load seller profile.',
    );
  });
});
