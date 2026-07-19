import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandProvider } from '@/brands/BrandProvider';
import EmailChangeConfirmation from '@/pages/EmailChangeConfirmation';
import { ServerStateProvider } from '@/serverState/queryClient';
import api from '@/services/api';
import { AuthTestProvider } from '@/test/AuthTestProvider';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function renderConfirmation(clearSession = vi.fn()) {
  render(
    <BrandProvider>
      <ServerStateProvider>
        <AuthTestProvider clearSession={clearSession}>
          <MemoryRouter>
            <EmailChangeConfirmation />
          </MemoryRouter>
        </AuthTestProvider>
      </ServerStateProvider>
    </BrandProvider>,
  );
}

describe('EmailChangeConfirmation', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('consumes the fragment token, clears it, and ends the old session', async () => {
    const clearSession = vi.fn();
    vi.mocked(api.post).mockResolvedValue({ data: undefined } as never);
    window.history.replaceState(
      {},
      '',
      '/account/email-change/confirm#token=selector.secret',
    );

    renderConfirmation(clearSession);

    expect(window.location.hash).toBe('');
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/auth/email-change/confirmations',
        { token: 'selector.secret' },
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'E-mail alterado. Entre novamente.',
    );
    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
  });

  it('rejects a confirmation URL without a fragment token locally', () => {
    window.history.replaceState({}, '', '/account/email-change/confirm');

    renderConfirmation();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O link é inválido ou expirou.',
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows a safe error when token confirmation fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('expired'));
    window.history.replaceState(
      {},
      '',
      '/account/email-change/confirm#token=expired-token',
    );

    renderConfirmation();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O link é inválido ou expirou.',
    );
    expect(window.location.hash).toBe('');
  });
});
