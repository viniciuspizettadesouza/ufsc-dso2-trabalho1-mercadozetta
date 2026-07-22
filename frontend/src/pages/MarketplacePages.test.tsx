import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Checkout from '@/pages/Checkout';
import Cart from '@/pages/Cart';
import BuyerOrders from '@/pages/BuyerOrders';
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
  price: { currency: 'USD', amountMinor: '1250' },
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
const address = {
  _id: '44444444-4444-4444-8444-444444444444',
  tenantId: 'mercadozetta',
  userId: 'buyer-1',
  label: 'Home',
  recipientName: 'Buyer',
  line1: '1 Market Street',
  line2: null,
  city: 'Lisbon',
  region: 'Lisbon',
  postalCode: '1000-001',
  countryCode: 'PT',
  telephone: '+351210000000',
  isDefault: true,
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
};
const checkoutQuote = {
  quoteId: 'a'.repeat(64),
  address,
  deliveryOption: {
    id: 'standard',
    label: 'Standard demo delivery',
    estimate: '3–5 business days (demo estimate)',
    shipping: { currency: 'USD', amountMinor: '499' },
  },
  subtotal: { currency: 'USD', amountMinor: '1250' },
  discount: { currency: 'USD', amountMinor: '0' },
  shipping: { currency: 'USD', amountMinor: '499' },
  total: { currency: 'USD', amountMinor: '1749' },
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
      if (url === '/account/addresses') return { data: [address] };
      if (url === '/orders?scope=buyer') {
        return { data: paginatedResponse(orders) };
      }
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/checkout/quote') return { data: checkoutQuote };
      throw new Error('network error');
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
    expect(api.post).toHaveBeenCalledWith(
      '/products/product-1/reviews',
      { rating: 5, comment: 'Great beans' },
      {
        headers: {
          'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
        },
      },
    );
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

  it('removes products already present in authenticated collections', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/products/product-1') return { data: product };
      if (url === '/cart') {
        return { data: { items: [{ product, quantity: 1 }] } };
      }
      if (url === '/watchlist') {
        return {
          data: [
            {
              _id: 'watch-1',
              product,
              createdAt: '2026-07-19T15:00:00.000Z',
            },
          ],
        };
      }
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { items: [] } });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />, {
      _id: 'user-1',
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Watching' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'In cart' }));

    expect(api.delete).toHaveBeenCalledWith('/watchlist/product-1');
    expect(api.delete).toHaveBeenCalledWith('/cart/items/product-1');
  });

  it('renders safe product fallbacks for optional catalog details', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/products/product-1') {
        return {
          data: {
            ...product,
            description: null,
            category: null,
            inventory: undefined,
            seller: '',
            sellerProfile: undefined,
          },
        };
      }
      return { data: paginatedResponse([]) };
    });

    renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

    expect(
      await screen.findByRole('heading', { name: 'Coffee' }),
    ).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Seller store' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Disponível:')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Store profile' }),
    ).not.toBeInTheDocument();
  });

  it('does not start detail queries when the product route has no id', () => {
    renderAt('/', '/', <ProductDetail />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading product...');
    expect(api.get).not.toHaveBeenCalledWith('/products/missing-product');
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

  it('places an order from the final checkout review', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === '/checkout/quote') return { data: checkoutQuote };
      if (url === '/orders')
        return {
          data: {
            _id: 'order-1',
            status: 'placed',
            pricingState: 'priced',
            subtotal: { currency: 'USD', amountMinor: '1250' },
            discount: { currency: 'USD', amountMinor: '0' },
            shipping: { currency: 'USD', amountMinor: '0' },
            total: { currency: 'USD', amountMinor: '1250' },
            items: [
              {
                productName: 'Coffee',
                quantity: 1,
                pricingState: 'priced',
                unitPrice: { currency: 'USD', amountMinor: '1250' },
                lineSubtotal: { currency: 'USD', amountMinor: '1250' },
              },
            ],
            statusHistory: [
              {
                status: 'placed',
                actor: 'buyer-1',
                changedAt: '2026-07-13T10:00:00.000Z',
              },
            ],
          },
        };
      throw new Error('unexpected request');
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByRole('link', { name: 'Coffee' })).toHaveAttribute(
      'href',
      '/products/product-1',
    );
    expect(screen.getByText(/\$12\.50 each/)).toBeInTheDocument();
    expect(screen.getByText(/Current cart quote:/)).toHaveTextContent('$12.50');
    const placeOrder = screen.getByRole('button', { name: 'Place order' });
    await waitFor(() => expect(placeOrder).toBeEnabled());
    await userEvent.click(placeOrder);

    expect(api.post).toHaveBeenCalledWith(
      '/orders',
      {
        addressId: address._id,
        deliveryOptionId: 'standard',
        quoteId: checkoutQuote.quoteId,
      },
      expect.objectContaining({
        headers: {
          'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
        },
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Order placed successfully.',
    );
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(screen.getByText('Cart is empty.')).toBeInTheDocument();
  });

  it('labels historical legacy orders as unpriced', async () => {
    mockCheckout({ items: [] }, [
      {
        _id: 'legacy-order',
        status: 'delivered',
        pricingState: 'legacy_unpriced',
        total: null,
        items: [{ productName: 'Old coffee', quantity: 1 }],
        statusHistory: [],
      },
    ]);

    renderAt('/orders', '/orders', <BuyerOrders />);

    expect(
      await screen.findByText(/Legacy order — price unavailable/),
    ).toBeInTheDocument();
  });

  it('formats priced historical orders using their immutable currency', async () => {
    mockCheckout({ items: [] }, [
      {
        _id: 'eur-order',
        status: 'delivered',
        pricingState: 'priced',
        total: { currency: 'EUR', amountMinor: '1250' },
        items: [
          {
            productName: 'Historical coffee',
            quantity: 1,
            lineSubtotal: { currency: 'EUR', amountMinor: '1250' },
          },
        ],
        statusHistory: [],
      },
    ]);

    renderAt('/orders', '/orders', <BuyerOrders />);

    const historicalOrder = await screen.findByText(
      (_content, node) =>
        node?.tagName === 'LI' &&
        Boolean(node.textContent?.includes('Total: €12.50')),
    );
    expect(historicalOrder).toHaveTextContent('Historical coffee × 1 — €12.50');
  });

  it('shows empty, failed, and delivery-snapshot order history states', async () => {
    mockCheckout({ items: [] });
    renderAt('/orders', '/orders', <BuyerOrders />);
    expect(
      await screen.findByText('You have not placed any orders yet.'),
    ).toBeInTheDocument();

    cleanup();
    vi.mocked(api.get).mockRejectedValue(new Error('network error'));
    renderAt('/orders', '/orders', <BuyerOrders />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load order history.',
    );

    cleanup();
    mockCheckout({ items: [] }, [
      {
        _id: 'snapshot-order',
        status: 'placed',
        pricingState: 'priced',
        total: null,
        deliveryAddress: address,
        deliveryOption: checkoutQuote.deliveryOption,
        items: [
          { productName: 'Snapshot coffee', quantity: 1, lineSubtotal: null },
        ],
        statusHistory: [],
      },
    ]);
    renderAt('/orders', '/orders', <BuyerOrders />);
    expect(
      (await screen.findByText(/Delivery snapshot:/)).closest('div'),
    ).toHaveTextContent('Buyer, 1 Market Street, Lisbon, 1000-001, PT');
    expect(screen.getByText('snapshot-order').closest('li')).toHaveTextContent(
      'Snapshot coffee × 1 — Total: Preço sob consulta',
    );
  });

  it('shows checkout loading and order submission errors', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
    renderAt('/checkout', '/checkout', <Checkout />);

    expect(screen.getByText('Loading checkout review...')).toBeInTheDocument();
    await screen.findByRole('link', { name: 'Coffee' });
    const placeOrder = screen.getByRole('button', { name: 'Place order' });
    await waitFor(() => expect(placeOrder).toBeEnabled());
    await userEvent.click(placeOrder);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to place order.',
    );
    expect(screen.getByRole('link', { name: 'Coffee' })).toBeInTheDocument();

    await userEvent.click(placeOrder);
    await waitFor(() =>
      expect(
        vi.mocked(api.post).mock.calls.filter(([url]) => url === '/orders'),
      ).toHaveLength(2),
    );
    const orderCalls = vi
      .mocked(api.post)
      .mock.calls.filter(([url]) => url === '/orders');
    expect(orderCalls[1][2]).toEqual(orderCalls[0][2]);
  });

  it('shows checkout load errors', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/cart') throw new Error('network error');
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load checkout review.',
    );
  });

  it('requires a saved delivery address before calculating the total', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/cart')
        return { data: { items: [{ product, quantity: 1 }] } };
      if (url === '/account/addresses') return { data: [] };
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(
      (await screen.findByRole('link', { name: 'Add a delivery address' }))
        .parentElement,
    ).toHaveTextContent('No delivery address is saved.');
    expect(
      screen.getByText(
        'Select or add a delivery address to calculate the final total.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalledWith(
      '/checkout/quote',
      expect.anything(),
    );
  });

  it('changes the selected address and delivery quote', async () => {
    const office = {
      ...address,
      _id: '55555555-5555-4555-8555-555555555555',
      label: 'Office',
      isDefault: false,
    };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/cart')
        return { data: { items: [{ product, quantity: 1 }] } };
      if (url === '/account/addresses') {
        return { data: [{ ...address, isDefault: false }, office] };
      }
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });
    vi.mocked(api.post).mockImplementation(async (url, input) => {
      if (url !== '/checkout/quote') throw new Error('unexpected request');
      const selection = input as {
        addressId: string;
        deliveryOptionId: 'standard' | 'express';
      };
      return {
        data: {
          ...checkoutQuote,
          address: selection.addressId === office._id ? office : address,
          deliveryOption: {
            ...checkoutQuote.deliveryOption,
            id: selection.deliveryOptionId,
          },
        },
      };
    });

    renderAt('/checkout', '/checkout', <Checkout />);

    expect(await screen.findByLabelText(/^Home:/)).toBeChecked();
    await userEvent.click(screen.getByLabelText(/^Office:/));
    await userEvent.click(screen.getByLabelText(/Express demo delivery/));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/checkout/quote', {
        addressId: office._id,
        deliveryOptionId: 'express',
      }),
    );
    expect(
      screen.getByRole('link', { name: 'Manage delivery addresses' }),
    ).toBeInTheDocument();
  });

  it('shows address and quote recovery states', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/cart')
        return { data: { items: [{ product, quantity: 1 }] } };
      if (url === '/account/addresses') throw new Error('address error');
      if (url === '/notifications/unread-count') return { data: { count: 0 } };
      return { data: paginatedResponse([]) };
    });
    renderAt('/checkout', '/checkout', <Checkout />);
    expect(
      await screen.findByText('Unable to load delivery addresses.'),
    ).toHaveAttribute('role', 'alert');

    cleanup();
    mockCheckout({ items: [{ product, quantity: 1 }] });
    vi.mocked(api.post).mockRejectedValue(new Error('quote error'));
    renderAt('/checkout', '/checkout', <Checkout />);
    expect(
      await screen.findByText('Unable to calculate the checkout total.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry total' }));
    await waitFor(() =>
      expect(
        vi
          .mocked(api.post)
          .mock.calls.filter(([url]) => url === '/checkout/quote').length,
      ).toBeGreaterThan(1),
    );
  });

  it('updates quantities and removes checkout items', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
    vi.mocked(api.put).mockResolvedValueOnce({
      data: { items: [{ product, quantity: 2 }] },
    });
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { items: [] } });

    renderAt('/cart', '/cart', <Cart />);

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

  it('rolls cart mutations back and preserves error copy', async () => {
    mockCheckout({ items: [{ product, quantity: 1 }] });
    vi.mocked(api.put).mockRejectedValue(new Error('network error'));
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'));

    renderAt('/cart', '/cart', <Cart />);

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

  it('renders seller fallbacks without optional contact or products', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: {
          _id: 'seller-1',
          username: null,
          telephone: null,
          email: null,
          storeName: null,
        },
      })
      .mockResolvedValueOnce({ data: paginatedResponse([]) });

    renderAt(
      '/sellers/seller-1/profile',
      '/sellers/:sellerId/profile',
      <SellerProfile />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Seller store' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Seller')).toBeInTheDocument();
    expect(screen.queryByText(/Contact:/)).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeEmptyDOMElement();
  });

  it('does not start seller queries when the route has no id', () => {
    renderAt('/', '/', <SellerProfile />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading seller...');
    expect(api.get).not.toHaveBeenCalledWith('/sellers/missing-seller');
  });
});
