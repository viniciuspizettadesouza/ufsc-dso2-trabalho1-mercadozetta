import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();

vi.mock('@/services/api', () => ({
  setAuthenticationFailureHandler: vi.fn(),
  default: {
    get: apiGet,
    post: vi.fn(),
  },
}));

async function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  const { default: App } = await import('@/App');

  return render(<App />);
}

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url) =>
      url === '/auth/session'
        ? Promise.reject(new Error('anonymous'))
        : Promise.resolve({ data: [] }),
    );
  });

  function authenticate(user = { _id: 'user-1', username: 'Seller' }) {
    apiGet.mockImplementation((url) => {
      if (url === '/auth/session') {
        return Promise.resolve({
          data: { user, session: { id: 'session-1' } },
        });
      }
      if (url === '/cart') return Promise.resolve({ data: { items: [] } });
      return Promise.resolve({ data: [] });
    });
  }

  it('renders the home page for /', async () => {
    await renderAppAt('/');

    expect(
      screen.getByRole('link', { name: 'Criar conta' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Nenhum produto encontrado'),
    ).toBeInTheDocument();
  });

  it('renders the app with the sample CampusMarket tenant', async () => {
    vi.stubEnv('VITE_TENANT_ID', 'campus-market');

    await renderAppAt('/');

    expect(
      screen.getByRole('img', { name: 'CampusMarket logo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Publicar oferta' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Nenhuma oferta encontrada'),
    ).toBeInTheDocument();
    expect(document.title).toBe('CampusMarket');
  });

  it('renders the login page for /login', async () => {
    await renderAppAt('/login');

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('renders the register page for /register', async () => {
    await renderAppAt('/register');

    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Phone')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar conta' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/products/new', 'Entre para criar um anúncio.'],
    ['/checkout', 'Entre para acessar o checkout.'],
    ['/admin', 'Entre para acessar o painel administrativo.'],
    ['/seller/orders', 'Entre para acessar os pedidos de vendedor.'],
  ])('requires authentication for %s', async (path, prompt) => {
    await renderAppAt(path);

    expect(await screen.findByText(prompt)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('renders the product creation page for authenticated users', async () => {
    authenticate();
    await renderAppAt('/products/new');

    expect(
      await screen.findByPlaceholderText('Product name'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Image URL')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    ).toBeInTheDocument();
  });

  it('renders the seller products page for /sellers/:sellerId', async () => {
    await renderAppAt('/sellers/seller-1');

    expect(
      await screen.findByText('Nenhum produto encontrado'),
    ).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/users/seller-1/products');
  });

  it('renders the product detail page for /products/:productId', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/auth/session')
        return Promise.reject(new Error('anonymous'));
      if (url === '/products/product-1')
        return Promise.resolve({
          data: {
            _id: 'product-1',
            name: 'Coffee',
            description: 'Fresh beans',
            image: 'coffee.jpg',
            seller: 'seller-1',
            sellerProfile: {
              _id: 'seller-1',
              username: 'Seller',
              storeName: 'Seller store',
            },
          },
        });
      return Promise.resolve({ data: [] });
    });

    await renderAppAt('/products/product-1');

    expect(
      await screen.findByRole('heading', { name: 'Coffee' }),
    ).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/products/product-1');
  });

  it('renders the checkout page for authenticated users', async () => {
    authenticate();
    await renderAppAt('/checkout');

    expect(
      await screen.findByRole('heading', { name: 'Checkout' }),
    ).toBeInTheDocument();
  });

  it('renders the admin dashboard for authenticated users', async () => {
    authenticate();

    await renderAppAt('/admin');

    expect(
      await screen.findByRole('heading', { name: 'Admin dashboard' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/products'));
  });
});
