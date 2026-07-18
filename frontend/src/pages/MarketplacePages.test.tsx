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
import { ServerStateProvider } from '@/serverState/queryClient';
import { paginatedResponse } from '@/test/paginatedResponse';

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
    <ServerStateProvider>
      <AuthTestProvider user={user}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
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

  function mockCheckout(cart: unknown, orders: object[] = []) {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/cart') return { data: cart };
      if (url === '/orders?scope=buyer') {
        return { data: paginatedResponse(orders) };
      }
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });
  }

  it('loads product details and records watchlist, cart, review, and notifications', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/products/product-1') return { data: product };
      if (url === '/cart') return { data: { items: [] } };
      if (url === '/watchlist') return { data: [] };
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
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
      .mockResolvedValueOnce({ data: paginatedResponse([]) });
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

  it('keeps the product loading state until initial reviews load', async () => {
    let resolveReviews!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/products/product-1') {
        return Promise.resolve({ data: product });
      }
      if (url === '/products/product-1/reviews') {
        return new Promise((resolve) => {
          resolveReviews = resolve;
        }) as never;
      }
      return Promise.resolve({ data: paginatedResponse([]) });
    });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading product...');
    expect(
      screen.queryByRole('heading', { name: 'Coffee' }),
    ).not.toBeInTheDocument();

    resolveReviews({ data: paginatedResponse([]) });

    expect(
      await screen.findByRole('heading', { name: 'Coffee' }),
    ).toBeInTheDocument();
  });

  it('keeps product details usable when collection revalidation fails', async () => {
    let watchlistReads = 0;
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/products/product-1') {
        return Promise.resolve({ data: product });
      }
      if (url === '/cart') return Promise.resolve({ data: { items: [] } });
      if (url === '/watchlist') {
        watchlistReads += 1;
        return watchlistReads === 1
          ? Promise.resolve({ data: [] })
          : Promise.reject(new Error('network error'));
      }
      if (url === '/notifications/unread-count') {
        return Promise.resolve({ data: { count: 0 } });
      }
      return Promise.resolve({ data: paginatedResponse([]) });
    });
    vi.mocked(api.put).mockResolvedValue({ data: {} });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />, {
      _id: 'user-1',
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Watch' }));
    expect(screen.getByRole('status')).toHaveTextContent('Added to watchlist.');
    await waitFor(() => expect(watchlistReads).toBe(2));
    expect(screen.getByRole('heading', { name: 'Coffee' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the previous review page visible while the next page loads', async () => {
    let resolveNextPage!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/products/product-1') {
        return Promise.resolve({ data: product });
      }
      if (url === '/products/product-1/reviews') {
        return Promise.resolve({
          data: {
            items: [
              { _id: 'review-1', rating: 5, comment: 'First-page review' },
            ],
            page: { limit: 20, offset: 0, total: 21, hasMore: true },
          },
        });
      }
      if (url === '/products/product-1/reviews?limit=20&offset=20') {
        return new Promise((resolve) => {
          resolveNextPage = resolve;
        }) as never;
      }
      return Promise.resolve({ data: paginatedResponse([]) });
    });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

    expect(await screen.findByText(/First-page review/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/First-page review/)).toBeInTheDocument();

    resolveNextPage({
      data: {
        items: [{ _id: 'review-21', rating: 4, comment: 'Second-page review' }],
        page: { limit: 20, offset: 20, total: 21, hasMore: false },
      },
    });

    expect(await screen.findByText(/Second-page review/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      '/products/product-1/reviews?limit=20&offset=20',
    );
  });

  it('checks out persisted cart items and refreshes order history', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
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
    mockCheckout({ items: [{ product, quantity: 1 }] });
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
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/cart') throw new Error('network error');
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load cart and order history.',
    );
  });

  it('updates quantities and removes checkout items', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
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

  it('rolls checkout cart mutations back and preserves error copy', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
    vi.mocked(api.put).mockRejectedValue(new Error('network error'));
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'));

    renderAt('/checkout', '/checkout', <Checkout />);

    const quantity = await screen.findByLabelText('Quantity for Coffee');
    await userEvent.selectOptions(quantity, '2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to update cart quantity.',
    );
    expect(quantity).toHaveValue('1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Coffee' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to remove cart item.',
    );
    expect(screen.getByLabelText('Quantity for Coffee')).toHaveValue('1');
  });

  it('disables checkout when a cart item is unavailable', async () => {
    mockCheckout({
      items: [
        {
          product: { ...product, inventory: 0, status: 'sold_out' },
          quantity: 1,
        },
      ],
    });

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
      .mockResolvedValueOnce({ data: paginatedResponse([product]) });

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
