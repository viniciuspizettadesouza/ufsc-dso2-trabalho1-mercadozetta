import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EmailVerificationConfirmation from '@/pages/EmailVerificationConfirmation';
import EmailVerificationRequest from '@/pages/EmailVerificationRequest';
import PasswordResetConfirmation from '@/pages/PasswordResetConfirmation';
import PasswordResetRequest from '@/pages/PasswordResetRequest';
import { ServerStateProvider } from '@/serverState/queryClient';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';

vi.mock('@/services/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

function renderPage(element: React.ReactNode, route = '/') {
  return render(
    <ServerStateProvider>
      <AuthTestProvider user={null}>
        <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
  );
}

describe('account recovery and verification workflow', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: 'If an eligible account exists, instructions will be sent.',
      },
    });
  });

  it('requests and confirms a password reset', async () => {
    renderPage(<PasswordResetRequest />);
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send password-reset link' }),
    );
    expect(api.post).toHaveBeenCalledWith('/auth/password-reset/requests', {
      email: 'buyer@example.com',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'If an eligible account exists',
    );

    cleanup();
    renderPage(
      <PasswordResetConfirmation />,
      '/password-reset/confirm#token=selector.secret',
    );
    await userEvent.type(screen.getByLabelText('New password'), 'new-password');
    await userEvent.type(
      screen.getByLabelText('Confirm new password'),
      'new-password',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' }),
    );
    expect(api.post).toHaveBeenLastCalledWith(
      '/auth/password-reset/confirmations',
      {
        token: 'selector.secret',
        password: 'new-password',
        passwordConfirmation: 'new-password',
      },
    );
    expect(screen.getByRole('status')).toHaveTextContent('Password reset.');
  });

  it('requests and confirms email verification', async () => {
    renderPage(<EmailVerificationRequest />);
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send verification link' }),
    );
    expect(api.post).toHaveBeenCalledWith('/auth/email-verification/requests', {
      email: 'buyer@example.com',
    });

    cleanup();
    renderPage(
      <EmailVerificationConfirmation />,
      '/email-verification/confirm#token=selector.secret',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(api.post).toHaveBeenLastCalledWith(
      '/auth/email-verification/confirmations',
      { token: 'selector.secret' },
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Email address verified.',
    );
  });

  it('shows missing-token and API failure recovery states', async () => {
    renderPage(<PasswordResetConfirmation />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'password-reset token is missing',
    );

    cleanup();
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    renderPage(
      <EmailVerificationConfirmation />,
      '/email-verification/confirm#token=expired',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to verify the email address.',
    );
  });

  it('keeps the email available when a delivery request fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    renderPage(<PasswordResetRequest />);

    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send password-reset link' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to submit the request.',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('buyer@example.com');
  });

  it('announces confirmation requests while they are pending', async () => {
    let resolveRequest!: (value: { data: undefined }) => void;
    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderPage(
      <EmailVerificationConfirmation />,
      '/email-verification/confirm#token=pending-token',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(
      await screen.findByRole('button', { name: 'Verifying email...' }),
    ).toBeDisabled();
    resolveRequest({ data: undefined });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Email address verified.',
    );

    cleanup();
    vi.mocked(api.post).mockReturnValue(new Promise(() => undefined));
    renderPage(
      <PasswordResetConfirmation />,
      '/password-reset/confirm#token=pending-token',
    );
    await userEvent.type(screen.getByLabelText('New password'), 'new-password');
    await userEvent.type(
      screen.getByLabelText('Confirm new password'),
      'new-password',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Resetting password...' }),
    ).toBeDisabled();
  });
});
