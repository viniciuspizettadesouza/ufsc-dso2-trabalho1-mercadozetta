import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandProvider } from '@/brands/BrandProvider';
import AccountSettings from '@/pages/AccountSettings';
import { ServerStateProvider } from '@/serverState/queryClient';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';

const navigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

function renderAccount(
  establishSession = vi.fn(),
  clearSession = vi.fn(),
  emailVerifiedAt?: string | null,
) {
  render(
    <BrandProvider>
      <ServerStateProvider>
        <AuthTestProvider
          user={{
            _id: 'user-1',
            email: 'seller@example.com',
            emailVerifiedAt,
            username: 'Seller',
            telephone: '123',
          }}
          establishSession={establishSession}
          clearSession={clearSession}
        >
          <MemoryRouter>
            <AccountSettings />
          </MemoryRouter>
        </AuthTestProvider>
      </ServerStateProvider>
    </BrandProvider>,
  );
}

describe('AccountSettings', () => {
  afterEach(cleanup);

  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { count: 0 } } as never);
  });

  it('updates the profile and refreshes the in-memory identity', async () => {
    const establishSession = vi.fn();
    const updated = {
      _id: 'user-1',
      email: 'seller@example.com',
      username: 'Updated Seller',
      telephone: null,
    };
    vi.mocked(api.patch).mockResolvedValue({ data: updated } as never);
    renderAccount(establishSession);

    const username = screen.getByLabelText('Nome');
    expect(username).toHaveValue('Seller');
    await userEvent.clear(username);
    await userEvent.type(username, 'Updated Seller');
    await userEvent.clear(screen.getByLabelText('Telefone'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Salvar perfil' }),
    );

    expect(api.patch).toHaveBeenCalledWith('/account/profile', {
      username: 'Updated Seller',
      telephone: null,
    });
    expect(establishSession).toHaveBeenCalledWith(updated);
    expect(screen.getByRole('status')).toHaveTextContent('Perfil atualizado.');
  });

  it('offers verification and address management for an unverified account', () => {
    renderAccount(vi.fn(), vi.fn(), null);

    expect(
      screen.getByRole('link', { name: 'Manage delivery addresses' }),
    ).toHaveAttribute('href', '/account/addresses');
    expect(
      screen.getByRole('link', { name: 'Request verification link' }),
    ).toHaveAttribute('href', '/email-verification');
  });

  it('shows an API profile error without replacing the current identity', async () => {
    const establishSession = vi.fn();
    vi.mocked(api.patch).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'Esse nome já está em uso.' } },
    });
    renderAccount(establishSession);

    await userEvent.click(
      screen.getByRole('button', { name: 'Salvar perfil' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esse nome já está em uso.',
    );
    expect(api.patch).toHaveBeenCalledWith('/account/profile', {
      username: 'Seller',
      telephone: '123',
    });
    expect(establishSession).not.toHaveBeenCalled();
  });

  it('explains unavailable delivery and preserves the submitted email', async () => {
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: 'ACCOUNT_DELIVERY_UNAVAILABLE' } },
    });
    renderAccount();
    const section = screen
      .getByRole('heading', { name: 'Alterar e-mail' })
      .closest('section')!;

    await userEvent.type(
      within(section).getByLabelText('Novo e-mail'),
      'new@example.com',
    );
    await userEvent.type(
      within(section).getByLabelText('Senha atual'),
      'secret',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Enviar confirmação' }),
    );

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'A confirmação por e-mail ainda não está disponível.',
    );
    expect(within(section).getByLabelText('Novo e-mail')).toHaveValue(
      'new@example.com',
    );
  });

  it('shows the server result after requesting an email change', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: 'Confira o novo e-mail para confirmar a alteração.' },
    } as never);
    renderAccount();
    const section = screen
      .getByRole('heading', { name: 'Alterar e-mail' })
      .closest('section')!;

    await userEvent.type(
      within(section).getByLabelText('Novo e-mail'),
      'new@example.com',
    );
    await userEvent.type(
      within(section).getByLabelText('Senha atual'),
      'secret',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Enviar confirmação' }),
    );

    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Confira o novo e-mail para confirmar a alteração.',
    );
  });

  it('clears the session and returns to login after a password change', async () => {
    const clearSession = vi.fn();
    vi.mocked(api.post).mockResolvedValue({ data: undefined } as never);
    renderAccount(vi.fn(), clearSession);
    const section = screen
      .getByRole('heading', { name: 'Alterar senha' })
      .closest('section')!;

    await userEvent.type(
      within(section).getByLabelText('Senha atual'),
      'old-password',
    );
    await userEvent.type(
      within(section).getByLabelText('Nova senha'),
      'new-password',
    );
    await userEvent.type(
      within(section).getByLabelText('Confirmar nova senha'),
      'new-password',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Alterar senha' }),
    );

    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
    expect(navigate).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { prompt: 'Senha alterada. Entre novamente.' },
    });
  });

  it('disables a password action while its request is pending', async () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => undefined) as never);
    renderAccount();
    const section = screen
      .getByRole('heading', { name: 'Alterar senha' })
      .closest('section')!;
    const action = within(section).getByRole('button', {
      name: 'Alterar senha',
    });

    await userEvent.type(
      within(section).getByLabelText('Senha atual'),
      'old-password',
    );
    await userEvent.type(
      within(section).getByLabelText('Nova senha'),
      'new-password',
    );
    await userEvent.type(
      within(section).getByLabelText('Confirmar nova senha'),
      'new-password',
    );
    await userEvent.click(action);

    expect(action).toBeDisabled();
    expect(action).toHaveAttribute('aria-busy', 'true');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('requires the explicit deactivation phrase before contacting the API', () => {
    renderAccount();
    const section = screen
      .getByRole('heading', { name: 'Desativar conta' })
      .closest('section')!;

    fireEvent.submit(within(section).getByRole('button').closest('form')!);

    expect(within(section).getByRole('alert')).toHaveTextContent(
      'Digite DEACTIVATE para confirmar a desativação.',
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('deactivates the account and returns to login', async () => {
    const clearSession = vi.fn();
    vi.mocked(api.post).mockResolvedValue({ data: undefined } as never);
    renderAccount(vi.fn(), clearSession);
    const section = screen
      .getByRole('heading', { name: 'Desativar conta' })
      .closest('section')!;

    await userEvent.type(
      within(section).getByLabelText('Senha atual'),
      'current-password',
    );
    await userEvent.type(
      within(section).getByLabelText('Digite DEACTIVATE'),
      'DEACTIVATE',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Desativar conta' }),
    );

    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledWith('/account/deactivation', {
      currentPassword: 'current-password',
      confirmation: 'DEACTIVATE',
    });
    expect(navigate).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { prompt: 'Conta desativada.' },
    });
  });

  it('shows a fallback error when account deactivation fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    renderAccount();
    const section = screen
      .getByRole('heading', { name: 'Desativar conta' })
      .closest('section')!;

    await userEvent.type(
      within(section).getByLabelText('Senha atual'),
      'current-password',
    );
    await userEvent.type(
      within(section).getByLabelText('Digite DEACTIVATE'),
      'DEACTIVATE',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Desativar conta' }),
    );

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Não foi possível desativar a conta.',
    );
  });
});
