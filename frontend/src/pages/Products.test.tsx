import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Products from '@/pages/Products';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';
import type { AuthUser } from '@/auth/AuthContext';
import { ServerStateProvider } from '@/serverState/queryClient';
import { paginatedResponse } from '@/test/paginatedResponse';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const products = [
  {
    _id: 'product-1',
    name: 'Coffee',
    description: 'Fresh beans',
    image: 'coffee.jpg',
    category: 'drinks',
    inventory: 3,
    price: { currency: 'USD', amountMinor: '1250' },
    status: 'active' as const,
    seller: 'seller-1',
  },
  {
    _id: 'product-2',
    name: 'Tea',
    description: 'Green leaves',
    image: 'tea.jpg',
    inventory: 0,
    price: null,
    status: 'paused' as const,
  },
];

function renderProducts(route = '/', path = '/', user: AuthUser | null = null) {
  return render(
    <ServerStateProvider>
      <AuthTestProvider user={user}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={<Products />} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
  );
}

describe('Products', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('loads all products on the home page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: paginatedResponse(products),
    });

    renderProducts();

    expect(
      screen.getByRole('status', { name: 'Carregando produtos...' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Coffee')).toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(screen.getByText('Preço sob consulta')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('drinks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'seller-1' })).toHaveAttribute(
      'href',
      '/sellers/seller-1/profile',
    );
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Pausado')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/products');
  });

  it('loads seller products on seller pages', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: paginatedResponse([products[0]]),
    });

    renderProducts('/sellers/seller-1', '/sellers/:sellerId');

    expect(await screen.findByText('Coffee')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/users/seller-1/products');
  });

  it('shows API failure state', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

    renderProducts();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os produtos.',
    );
  });

  it('filters products case-insensitively and handles no results', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: paginatedResponse(products),
    });

    renderProducts();

    await screen.findByText('Coffee');
    await userEvent.type(screen.getByPlaceholderText('Buscar produto'), 'TE');

    expect(screen.getByText('Tea')).toBeInTheDocument();
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText('Buscar produto'));
    expect(screen.getByText('Coffee')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Buscar produto'), 'zz');
    expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
  });

  it('requests backend filters with query params', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: paginatedResponse(products) })
      .mockResolvedValueOnce({ data: paginatedResponse([products[1]]) });

    renderProducts();

    await screen.findByText('Coffee');
    await userEvent.type(screen.getByPlaceholderText('Buscar produto'), 'tea');
    await userEvent.type(screen.getByLabelText('Categoria'), 'drinks');
    await userEvent.selectOptions(
      screen.getByLabelText('Disponibilidade'),
      'sold_out',
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Ordenar produtos'),
      'name_asc',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Buscar produtos' }),
    );

    expect(api.get).toHaveBeenLastCalledWith(
      '/products?q=tea&category=drinks&availability=sold_out&sort=name_asc&limit=20&offset=0',
    );
  });

  it('shows backend filter failures', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: paginatedResponse(products) })
      .mockRejectedValueOnce(new Error('network error'));

    renderProducts();

    await screen.findByText('Coffee');
    await userEvent.click(
      screen.getByRole('button', { name: 'Buscar produtos' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os produtos.',
    );
  });

  it('toggles persisted watchlist and cart state', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: paginatedResponse(products) })
      .mockResolvedValueOnce({ data: [{ product: products[0] }] })
      .mockResolvedValueOnce({
        data: { items: [{ product: products[0], quantity: 1 }] },
      });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    renderProducts('/', '/', { _id: 'user-1' });

    expect(
      await screen.findByRole('button', { name: 'Favorito' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'No carrinho' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Favorito' }));
    await userEvent.click(screen.getByRole('button', { name: 'No carrinho' }));

    expect(api.delete).toHaveBeenCalledWith('/watchlist/product-1');
    expect(api.delete).toHaveBeenCalledWith('/cart/items/product-1');
  });

  it('adds catalog products to persisted commerce collections', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: paginatedResponse(products),
    });
    vi.mocked(api.put).mockResolvedValue({ data: {} });

    renderProducts();

    const favoriteButtons = await screen.findAllByRole('button', {
      name: 'Favoritar',
    });
    const cartButtons = screen.getAllByRole('button', { name: 'Carrinho' });
    await userEvent.click(favoriteButtons[0]);
    await userEvent.click(cartButtons[0]);
    expect(api.put).toHaveBeenCalledWith('/watchlist/product-1');
    expect(api.put).toHaveBeenCalledWith('/cart/items', {
      productId: 'product-1',
      quantity: 1,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Produto adicionado ao carrinho.',
    );
  });

  it('shows API errors without changing catalog commerce state', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: paginatedResponse(products),
    });
    vi.mocked(api.put).mockRejectedValue(new Error('network error'));

    renderProducts();

    const favoriteButtons = await screen.findAllByRole('button', {
      name: 'Favoritar',
    });
    await userEvent.click(favoriteButtons[0]);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível atualizar os favoritos.',
    );
    expect(favoriteButtons[0]).toHaveTextContent('Favoritar');
  });

  it('renders image alt text from product name', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: paginatedResponse(products),
    });

    renderProducts();

    expect(await screen.findByRole('img', { name: 'Coffee' })).toHaveAttribute(
      'src',
      'coffee.jpg',
    );
  });

  it('navigates bounded catalog pages and exposes owner management', async () => {
    vi.mocked(api.get).mockImplementation(async (path) => {
      if (path === '/watchlist') return { data: [] } as never;
      if (path === '/cart') return { data: { items: [] } } as never;
      if (path === '/notifications/unread-count')
        return { data: { count: 0 } } as never;
      return {
        data: {
          items: [products[0]],
          page:
            path === '/products'
              ? { limit: 20, offset: 0, total: 21, hasMore: true }
              : { limit: 20, offset: 20, total: 21, hasMore: false },
        },
      } as never;
    });

    renderProducts('/', '/', { _id: 'seller-1' });

    expect(
      await screen.findByRole('link', { name: 'Manage listing' }),
    ).toHaveAttribute('href', '/products/product-1/edit');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(api.get).toHaveBeenCalledWith(
      '/products?sort=created_desc&limit=20&offset=20',
    );
  });

  it('keeps the previous catalog page visible while the next page loads', async () => {
    let resolveNextPage!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation((path) => {
      if (path === '/products') {
        return Promise.resolve({
          data: {
            items: [products[0]],
            page: { limit: 20, offset: 0, total: 21, hasMore: true },
          },
        });
      }

      return new Promise((resolve) => {
        resolveNextPage = resolve;
      }) as never;
    });

    renderProducts();

    expect(await screen.findByText('Coffee')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Carregando produtos...' }),
    ).not.toBeInTheDocument();

    resolveNextPage({
      data: {
        items: [products[1]],
        page: { limit: 20, offset: 20, total: 21, hasMore: false },
      },
    });

    expect(await screen.findByText('Tea')).toBeInTheDocument();
  });
});
