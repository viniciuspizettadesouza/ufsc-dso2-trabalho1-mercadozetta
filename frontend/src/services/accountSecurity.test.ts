import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  confirmEmailVerification,
  confirmPasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from '@/services/accountSecurity';

vi.mock('@/services/api', () => ({ default: { post: vi.fn() } }));

describe('account-security service', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  it('requests recovery and verification without changing the generic response', async () => {
    const response = {
      message:
        'If an eligible account exists, instructions will be sent.' as const,
    };
    vi.mocked(api.post).mockResolvedValue({ data: response });

    await expect(
      requestPasswordReset({ email: 'buyer@example.com' }),
    ).resolves.toBe(response);
    await expect(
      requestEmailVerification({ email: 'buyer@example.com' }),
    ).resolves.toBe(response);

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/auth/password-reset/requests',
      {
        email: 'buyer@example.com',
      },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/auth/email-verification/requests',
      { email: 'buyer@example.com' },
    );
  });

  it('confirms single-use reset and verification tokens', async () => {
    vi.mocked(api.post).mockResolvedValue({});

    await confirmPasswordReset({
      token: 'selector.secret',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    await confirmEmailVerification('selector.secret');

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/auth/password-reset/confirmations',
      {
        token: 'selector.secret',
        password: 'new-password',
        passwordConfirmation: 'new-password',
      },
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/auth/email-verification/confirmations',
      { token: 'selector.secret' },
    );
  });
});
