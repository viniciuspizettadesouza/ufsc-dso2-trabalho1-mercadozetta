import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Header from '@/pages/header/index';
import { BrandProvider } from '@/brands/BrandProvider';
import { campusMarketBrand, type BrandConfig } from '@/brands';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';
import type { AuthUser } from '@/auth/AuthContext';
import { ServerStateProvider } from '@/serverState/queryClient';

const navigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

function renderHeader(
  route: string | { pathname: string; state?: unknown } = '/',
  hideLoginAction = false,
  brand?: BrandConfig,
  user: AuthUser | null = null,
  clearSession = vi.fn(),
) {
  return render(
    <BrandProvider brand={brand}>
      <ServerStateProvider>
        <AuthTestProvider user={user} clearSession={clearSession}>
          <MemoryRouter initialEntries={[route]}>
            <Header hideLoginAction={hideLoginAction} />
          </MemoryRouter>
        </AuthTestProvider>
      </ServerStateProvider>
    </BrandProvider>,
  );
}

describe('Header', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { count: 0 } } as never);
    vi.mocked(api.post).mockResolvedValue({} as never);
  });

  it('shows the brand logo', () => {
    renderHeader();

    expect(
      screen.getByRole('img', { name: 'MercadoZetta logo' }),
    ).toBeInTheDocument();
  });

  it('renders a second brand config', () => {
    renderHeader('/', false, campusMarketBrand);

    expect(
      screen.getByRole('img', { name: 'CampusMarket logo' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('CampusMarket');
  });

  it('shows login action for anonymous users', async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('hides login action when requested', () => {
    renderHeader('/', true);

    expect(
      screen.queryByRole('button', { name: 'Entrar' }),
    ).not.toBeInTheDocument();
  });

  it('hides login action on the login page', () => {
    renderHeader('/login');

    expect(
      screen.queryByRole('button', { name: 'Entrar' }),
    ).not.toBeInTheDocument();
  });

  it('shows authenticated user data and logs out', async () => {
    const clearSession = vi.fn();

    renderHeader(
      '/',
      false,
      undefined,
      {
        _id: 'seller-1',
        username: 'Seller',
        email: 'seller@example.com',
        telephone: '123',
      },
      clearSession,
    );

    expect(screen.getByText('Seller')).toBeInTheDocument();
    expect(screen.getByText('seller@example.com')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(clearSession).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', {
      replace: true,
      state: { clearSessionAfterLogout: true },
    });
  });

  it('shows the unread notification count for authenticated users', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 3 } } as never);

    renderHeader('/', false, undefined, {
      _id: 'seller-1',
      username: 'Seller',
    });

    expect(
      await screen.findByLabelText('3 unread notifications'),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('prevents conflicting logout requests while logout is pending', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    vi.mocked(api.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }) as never,
    );
    renderHeader('/', false, undefined, {
      _id: 'seller-1',
      username: 'Seller',
    });
    const logout = screen.getByRole('button', { name: 'Sair' });
    await userEvent.click(logout);

    expect(logout).toBeDisabled();
    expect(logout).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(logout);
    expect(api.post).toHaveBeenCalledTimes(1);

    resolveRequest?.({});
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/', {
        replace: true,
        state: { clearSessionAfterLogout: true },
      }),
    );
  });

  it('keeps navigation usable when the unread count request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network error'));

    renderHeader('/', false, undefined, {
      _id: 'seller-1',
      username: 'Seller',
    });

    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
      'href',
      '/notifications',
    );
  });

  it('ignores an unread count response after unmounting', async () => {
    let resolveRequest!: (value: { data: { count: number } }) => void;
    vi.mocked(api.get).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    const { unmount } = renderHeader('/', false, undefined, {
      _id: 'seller-1',
      username: 'Seller',
    });
    unmount();
    resolveRequest({ data: { count: 4 } });

    await Promise.resolve();
  });

  it('clears the in-memory session even when server-side logout fails', async () => {
    const clearSession = vi.fn();
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    renderHeader(
      '/',
      false,
      undefined,
      {
        _id: 'seller-1',
        username: 'Seller',
      },
      clearSession,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(clearSession).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', {
      replace: true,
      state: { clearSessionAfterLogout: true },
    });
  });

  it('falls back to anonymous state without an in-memory user', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('clears auth after logout navigation reaches the public route', async () => {
    const clearSession = vi.fn();

    renderHeader(
      { pathname: '/', state: { clearSessionAfterLogout: true } },
      false,
      undefined,
      { _id: 'seller-1', username: 'Seller' },
      clearSession,
    );

    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
    expect(navigate).toHaveBeenCalledWith('/', { replace: true, state: null });
  });
});
