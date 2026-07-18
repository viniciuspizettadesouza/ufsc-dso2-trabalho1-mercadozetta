import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Login from '@/pages/Login';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';

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

function renderLogin(
  state?: { from: string; prompt: string },
  establishSession = vi.fn(),
) {
  return render(
    <AuthTestProvider establishSession={establishSession}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Login />
      </MemoryRouter>
    </AuthTestProvider>,
  );
}

describe('Login', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('calls the API, establishes auth state, and navigates after successful login', async () => {
    const establishSession = vi.fn();
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        user: {
          _id: 'user-1',
          email: 'seller@example.com',
        },
      },
    });

    renderLogin(undefined, establishSession);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Entrar' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'seller@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'seller@example.com',
        password: 'secret123',
      });
    });
    expect(establishSession).toHaveBeenCalledWith({
      _id: 'user-1',
      email: 'seller@example.com',
    });
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

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos',
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the auth prompt and returns to the protected route after login', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
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
