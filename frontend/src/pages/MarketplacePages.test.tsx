import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminDashboard from '@/pages/AdminDashboard';
import Checkout from '@/pages/Checkout';
import ProductDetail from '@/pages/ProductDetail';
import SellerProfile from '@/pages/SellerProfile';
import api from '@/services/api';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
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

function renderAt(route: string, path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('marketplace pages', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('loads product details and records watchlist, cart, review, and notifications', async () => {
    localStorage.setItem('token', 'token-123');
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: product })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { items: [] } })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({
      data: { _id: 'review-1', rating: 5, comment: 'Great beans' },
    });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

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
      },
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByText(/Coffee × 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() =>
      expect(screen.getByText(/order-1/)).toBeInTheDocument(),
    );
    expect(api.post).toHaveBeenCalledWith('/orders');
  });

  it('renders admin dashboard metrics and audit entries', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: [
          product,
          { ...product, _id: 'product-2', name: 'Tea', status: 'paused' },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ _id: 'notification-1', message: 'Order created' }],
      });

    renderAt('/admin', '/admin', <AdminDashboard />);

    expect(
      await screen.findByRole('heading', { name: 'Admin dashboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Product Tea is paused in drinks'),
    ).toBeInTheDocument();
    expect(screen.getByText('Order created')).toBeInTheDocument();
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
