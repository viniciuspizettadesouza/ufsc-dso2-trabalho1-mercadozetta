import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/model/user', () => ({
  default: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('@/services/sessionService', () => ({
  createSession: vi.fn(async () => ({
    accessToken: 'cookie-access-token',
    refreshToken: 'refresh-token',
    csrfToken: 'csrf-token',
    session: { id: 'session-1' },
  })),
  getSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcryptjs';
import User from '@/model/user';
import { authenticate, getSessionState, logout } from '@/services/authService';
import { getSession, revokeAllSessions } from '@/services/sessionService';

const mockedUser = User as typeof User & {
  findOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
};

const mockedGetSession = vi.mocked(getSession);
const mockedRevokeAllSessions = vi.mocked(revokeAllSessions);

const mockedBcrypt = bcrypt as typeof bcrypt & {
  compare: ReturnType<typeof vi.fn>;
};

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.findOne.mockReset();
    mockedBcrypt.compare.mockReset();
  });

  it('authenticates users and strips password from the response', async () => {
    mockedUser.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: 'user-1',
        password: 'hashed-password',
        tokenVersion: 0,
        toObject: () => ({
          _id: 'user-1',
          email: 'seller@example.com',
          password: 'hashed-password',
          tokenVersion: 0,
        }),
      }),
    });
    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await authenticate(
      { email: 'Seller@Example.com', password: 'secret123' },
      'mercadozetta',
    );

    expect(mockedUser.findOne).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
    });
    expect(mockedBcrypt.compare).toHaveBeenCalledWith(
      'secret123',
      'hashed-password',
    );
    expect(result.user).toEqual({ _id: 'user-1', email: 'seller@example.com' });
    expect(result).not.toHaveProperty('token');
    expect(result.session).toEqual({ id: 'session-1' });
  });

  it('revokes all sessions after incrementing the user token version', async () => {
    mockedUser.updateOne.mockResolvedValue({ matchedCount: 1 } as any);

    await logout('user-1', 'mercadozetta');

    expect(mockedUser.updateOne).toHaveBeenCalledWith(
      { _id: 'user-1', tenantId: 'mercadozetta' },
      { $inc: { tokenVersion: 1 } },
    );
    expect(mockedRevokeAllSessions).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      expect.any(Date),
    );

    mockedUser.updateOne.mockResolvedValue({ matchedCount: 0 } as any);
    await expect(logout('missing', 'mercadozetta')).rejects.toMatchObject({
      code: 'INVALID_AUTH_TOKEN',
    });
  });

  it('restores safe user and session state and rejects a deleted user', async () => {
    mockedGetSession.mockResolvedValue({ id: 'session-1' } as any);
    const select = vi.fn().mockResolvedValue({
      toObject: () => ({
        _id: 'user-1',
        email: 'seller@example.com',
        password: 'hidden',
        tokenVersion: 2,
      }),
    });
    mockedUser.findOne.mockReturnValue({ select } as any);

    await expect(
      getSessionState('session-1', 'user-1', 'mercadozetta'),
    ).resolves.toEqual({
      user: { _id: 'user-1', email: 'seller@example.com' },
      session: { id: 'session-1' },
    });

    select.mockResolvedValueOnce(null);
    await expect(
      getSessionState('session-1', 'user-1', 'mercadozetta'),
    ).rejects.toMatchObject({ code: 'INVALID_AUTH_TOKEN' });
  });
});
