import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

import AddProduct from '@/pages/AddProduct';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';
import type { AuthUser } from '@/auth/AuthContext';
import { ServerStateProvider } from '@/serverState/queryClient';

const navigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

function renderAddProduct(user: AuthUser | null = null) {
  return render(
    <ServerStateProvider>
      <AuthTestProvider user={user}>
        <MemoryRouter>
          <AddProduct />
        </MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
  );
}

async function fillProductForm() {
  await userEvent.type(screen.getByLabelText('Product name'), 'Coffee');
  await userEvent.type(
    screen.getByLabelText('Product description'),
    'Fresh beans',
  );
  await userEvent.type(screen.getByLabelText('Quantity'), '3');
  await userEvent.type(screen.getByLabelText('Enviar imagem'), 'coffee.jpg');
}

describe('AddProduct', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { count: 0 } } as never);
  });

  it('shows an auth error when the user is not logged in', async () => {
    renderAddProduct();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Criar anúncio' }),
    ).toBeInTheDocument();

    await fillProductForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Entre para criar um anúncio.',
    );
    expect(api.post).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('creates a product and redirects to the seller page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { _id: 'product-1' },
    });

    renderAddProduct({ _id: 'user-1' });

    await fillProductForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/products',
        {
          name: 'Coffee',
          description: 'Fresh beans',
          category: 'general',
          subcategory: '',
          inventory: 3,
          image: 'coffee.jpg',
          status: 'active',
        },
        {
          headers: {
            'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
          },
        },
      );
    });
    expect(navigate).toHaveBeenCalledWith('/sellers/user-1');
  });

  it('submits the selected product status', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { _id: 'product-1' },
    });

    renderAddProduct({ _id: 'user-1' });

    await fillProductForm();
    await userEvent.selectOptions(
      screen.getByLabelText('Status do produto'),
      'draft',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/products',
        expect.objectContaining({
          status: 'draft',
        }),
        expect.objectContaining({
          headers: {
            'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
          },
        }),
      );
    });
  });

  it('prevents conflicting submissions while creation is pending', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    vi.mocked(api.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }) as never,
    );

    renderAddProduct({ _id: 'user-1' });
    await fillProductForm();
    const submit = screen.getByRole('button', { name: 'Criar anúncio' });
    await userEvent.click(submit);

    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(submit);
    expect(api.post).toHaveBeenCalledTimes(1);

    resolveRequest?.({ data: { _id: 'product-1' } });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/sellers/user-1'),
    );
  });

  it('shows a generic error when product creation fails without an API message', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('network error'));

    renderAddProduct({ _id: 'user-1' });

    await fillProductForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar o anúncio. Tente novamente.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('handles a missing in-memory user as logged out', async () => {
    renderAddProduct();

    await fillProductForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Entre para criar um anúncio.',
    );
  });

  it('shows the API error when product creation fails', async () => {
    const error = new AxiosError(
      'Product registration failed',
      undefined,
      undefined,
      undefined,
      {
        data: { error: 'Name, quantity and image are required' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );

    vi.mocked(api.post).mockRejectedValueOnce(error);

    renderAddProduct({ _id: 'user-1' });

    await fillProductForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'Criar anúncio' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name, quantity and image are required',
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
