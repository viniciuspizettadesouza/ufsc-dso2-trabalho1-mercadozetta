import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import { type AuthState, login, logout, restoreSession } from '@/services/auth';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const authState = {
  user: {
    _id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'mercadozetta',
    email: 'seller@example.com',
    emailVerifiedAt: null,
    username: 'Seller',
    telephone: '+5548999999999',
    createdAt: '2026-07-18T10:00:00.000Z',
    updatedAt: '2026-07-18T10:00:00.000Z',
  },
  session: {
    id: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-07-18T10:00:00.000Z',
    lastUsedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T10:15:00.000Z',
    absoluteExpiresAt: '2026-07-25T10:00:00.000Z',
  },
} satisfies AuthState;

describe('auth service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('logs in through the shared route and returns the auth state', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: authState });
    const input = { email: 'seller@example.com', password: 'secret123' };

    await expect(login(input)).resolves.toBe(authState);

    expect(api.post).toHaveBeenCalledWith('/auth/login', input);
  });

  it('restores the session through the shared route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: authState });

    await expect(restoreSession()).resolves.toBe(authState);

    expect(api.get).toHaveBeenCalledWith('/auth/session');
  });

  it('logs out through the shared route', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: undefined });

    await expect(logout()).resolves.toBeUndefined();

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });
});
