import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Login from '@/pages/Login';
import api from '@/services/api';

const navigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
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

function renderLogin(state?: { from: string; prompt: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    navigate.mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('calls the API, stores auth data, and navigates after successful login', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        token: 'token-123',
        user: {
          _id: 'user-1',
          email: 'seller@example.com',
        },
      },
    });

    renderLogin();

    await userEvent.type(
      screen.getByPlaceholderText('Email'),
      'seller@example.com',
    );
    await userEvent.type(screen.getByPlaceholderText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'seller@example.com',
        password: 'secret123',
      });
    });
    expect(localStorage.getItem('token')).toBe('token-123');
    expect(localStorage.getItem('user')).toBe(
      JSON.stringify({
        _id: 'user-1',
        email: 'seller@example.com',
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/sellers/user-1');
  });

  it('shows an error when login fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();

    await userEvent.type(
      screen.getByPlaceholderText('Email'),
      'seller@example.com',
    );
    await userEvent.type(
      screen.getByPlaceholderText('Password'),
      'wrong-password',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('E-mail ou senha inválidos'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the auth prompt and returns to the protected route after login', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        token: 'token-123',
        user: { _id: 'user-1' },
      },
    });

    renderLogin({
      from: '/checkout',
      prompt: 'Entre para acessar o checkout.',
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Entre para acessar o checkout.',
    );
    await userEvent.type(
      screen.getByPlaceholderText('Email'),
      'buyer@test.com',
    );
    await userEvent.type(screen.getByPlaceholderText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/checkout', { replace: true });
    });
  });
});
