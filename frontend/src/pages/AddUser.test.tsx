import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

import AddUser from '@/pages/AddUser';
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

function renderAddUser() {
  return render(
    <MemoryRouter>
      <AddUser />
    </MemoryRouter>,
  );
}

describe('AddUser', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('shows the API error when registration fails', async () => {
    const error = new AxiosError(
      'User already exists',
      undefined,
      undefined,
      undefined,
      {
        data: { error: 'User already exists' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );

    vi.mocked(api.post).mockRejectedValueOnce(error);

    renderAddUser();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Criar conta' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name'), 'Smoke User');
    await userEvent.type(screen.getByLabelText('Phone'), '48999999999');
    await userEvent.type(screen.getByLabelText('Email'), 'smoke@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User already exists',
    );
    expect(navigate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users', {
        username: 'Smoke User',
        telephone: '48999999999',
        email: 'smoke@example.com',
        password: 'secret123',
      });
    });
  });
});
