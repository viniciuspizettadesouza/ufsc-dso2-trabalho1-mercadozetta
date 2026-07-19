import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EditProduct from '@/pages/EditProduct';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';
import { ServerStateProvider } from '@/serverState/queryClient';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

const product = {
  _id: 'product-1',
  name: 'Coffee',
  description: 'Beans',
  category: 'drinks',
  subcategory: '',
  image: 'coffee.jpg',
  inventory: 3,
  price: { currency: 'USD', amountMinor: '1250' },
  status: 'active' as const,
};

function renderPage(
  route = '/products/product-1/edit',
  path = '/products/:productId/edit',
) {
  return render(
    <ServerStateProvider>
      <AuthTestProvider user={{ _id: 'seller-1' }}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={<EditProduct />} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
  );
}

describe('EditProduct', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/notifications/unread-count'
        ? ({ data: { count: 0 } } as never)
        : ({ data: product } as never),
    );
  });

  it('updates explicit listing details and inventory', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: product } as never);
    renderPage();

    const name = await screen.findByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Updated coffee');
    const description = screen.getByLabelText('Description');
    await userEvent.clear(description);
    await userEvent.type(description, 'Fresh beans');
    const category = screen.getByLabelText('Category');
    await userEvent.clear(category);
    await userEvent.type(category, 'grocery');
    await userEvent.type(screen.getByLabelText('Subcategory'), 'beans');
    const image = screen.getByLabelText('Image URL');
    await userEvent.clear(image);
    await userEvent.type(image, 'updated.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/products/product-1', {
        name: 'Updated coffee',
        description: 'Fresh beans',
        category: 'grocery',
        subcategory: 'beans',
        image: 'updated.jpg',
        price: { currency: 'USD', amountMinor: '1250' },
      }),
    );

    const inventory = screen.getByLabelText('Available units');
    await userEvent.clear(inventory);
    await userEvent.type(inventory, '0');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save inventory' }),
    );
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/products/product-1/inventory', {
        inventory: 0,
      }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'paused');
    await userEvent.click(screen.getByRole('button', { name: 'Save status' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/products/product-1/status', {
        status: 'paused',
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Product updated.');
  });

  it('preserves form state and shows API errors', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('forbidden'));
    renderPage();
    const name = await screen.findByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Still here');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to update product.',
    );
    expect(name).toHaveValue('Still here');
  });

  it('shows product load failures', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load product.',
    );
  });

  it('initializes safe defaults for optional editable product fields', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/notifications/unread-count'
        ? ({ data: { count: 0 } } as never)
        : ({
            data: {
              ...product,
              description: null,
              category: null,
              subcategory: null,
              inventory: undefined,
              price: null,
              status: null,
            },
          } as never),
    );

    renderPage();

    expect(await screen.findByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Category')).toHaveValue('general');
    expect(screen.getByLabelText('Subcategory')).toHaveValue('');
    expect(screen.getByLabelText('Available units')).toHaveValue(0);
    expect(screen.getByLabelText('Price (USD)')).toHaveValue(null);
    expect(screen.getByLabelText('Status')).toHaveValue('draft');
  });

  it('renders no management form when the route has no product id', () => {
    renderPage('/edit', '/edit');

    expect(
      screen.queryByRole('heading', { name: 'Manage product' }),
    ).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/products/missing-product');
  });
});
