import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  changePassword,
  confirmEmailChange,
  deactivateAccount,
  requestEmailChange,
  updateProfile,
} from '@/services/account';

vi.mock('@/services/api', () => ({
  default: {
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

describe('account service', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('updates the authenticated profile', async () => {
    const user = {
      _id: 'user-1',
      email: 'seller@example.com',
      username: 'Updated Seller',
      telephone: null,
    };
    vi.mocked(api.patch).mockResolvedValue({ data: user } as never);

    await expect(
      updateProfile({ username: 'Updated Seller', telephone: null }),
    ).resolves.toEqual(user);
    expect(api.patch).toHaveBeenCalledWith('/account/profile', {
      username: 'Updated Seller',
      telephone: null,
    });
  });

  it('maps credential and lifecycle mutations to the account API', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: undefined } as never);

    await changePassword({
      currentPassword: 'old-password',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    await confirmEmailChange('selector.secret');
    await deactivateAccount({
      currentPassword: 'old-password',
      confirmation: 'DEACTIVATE',
    });

    expect(api.post).toHaveBeenNthCalledWith(1, '/account/password-changes', {
      currentPassword: 'old-password',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/auth/email-change/confirmations',
      { token: 'selector.secret' },
    );
    expect(api.post).toHaveBeenNthCalledWith(3, '/account/deactivation', {
      currentPassword: 'old-password',
      confirmation: 'DEACTIVATE',
    });
  });

  it('returns the email-change delivery result', async () => {
    const response = { message: 'Confirmation sent.' };
    vi.mocked(api.post).mockResolvedValue({ data: response } as never);

    await expect(
      requestEmailChange({
        email: 'new@example.com',
        currentPassword: 'password',
      }),
    ).resolves.toEqual(response);
    expect(api.post).toHaveBeenCalledWith('/account/email-changes', {
      email: 'new@example.com',
      currentPassword: 'password',
    });
  });
});
