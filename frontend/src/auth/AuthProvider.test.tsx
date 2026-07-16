import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/auth/AuthContext';
import { AuthProvider } from '@/auth/AuthProvider';
import api, { setAuthenticationFailureHandler } from '@/services/api';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
  setAuthenticationFailureHandler: vi.fn(),
}));

function AuthStateView() {
  const { status, user } = useAuth();
  return <p>{`${status}:${user?.username ?? 'none'}`}</p>;
}

describe('AuthProvider', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(setAuthenticationFailureHandler).mockReset();
  });

  it('restores an in-memory user from the cookie session endpoint', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        user: { _id: 'user-1', username: 'Seller' },
        session: { id: 'session-1' },
      },
    });

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(screen.getByText('loading:none')).toBeInTheDocument();
    expect(await screen.findByText('authenticated:Seller')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/auth/session');
  });

  it('becomes anonymous when no cookie session can be restored', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('unauthorized'));

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(await screen.findByText('anonymous:none')).toBeInTheDocument();
  });

  it('clears the in-memory user after automatic renewal fails', async () => {
    let handleFailure: (() => void) | null = null;
    vi.mocked(setAuthenticationFailureHandler).mockImplementation((handler) => {
      handleFailure = handler;
    });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { user: { _id: 'user-1', username: 'Seller' } },
    });

    render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    expect(await screen.findByText('authenticated:Seller')).toBeInTheDocument();
    act(() => handleFailure?.());
    expect(screen.getByText('anonymous:none')).toBeInTheDocument();
  });

  it('ignores a successful bootstrap response after unmounting', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.get).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
    );
    const view = render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    view.unmount();
    await act(async () => {
      finish({ data: { user: { _id: 'user-1' } } });
      await Promise.resolve();
    });
  });

  it('ignores a failed bootstrap response after unmounting', async () => {
    let fail!: (reason: unknown) => void;
    vi.mocked(api.get).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }) as never,
    );
    const view = render(
      <AuthProvider>
        <AuthStateView />
      </AuthProvider>,
    );

    view.unmount();
    await act(async () => {
      fail(new Error('unauthorized'));
      await Promise.resolve();
    });
  });
});
