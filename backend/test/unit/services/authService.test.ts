import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '@/repositories/userRepository';
import {
  createAuthService,
  type AuthSessionService,
} from '@/services/authService';

function repository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    emailExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    findPublicById: vi.fn().mockResolvedValue(null),
    findForAuthentication: vi.fn().mockResolvedValue(null),
    findTokenVersion: vi.fn().mockResolvedValue(null),
    hasTokenVersion: vi.fn().mockResolvedValue(false),
    incrementTokenVersion: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function sessions(
  overrides: Partial<AuthSessionService> = {},
): AuthSessionService {
  return {
    createSession: vi.fn().mockResolvedValue({
      accessToken: 'cookie-access-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
      session: { id: 'session-1' },
    }),
    getSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
    revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('authService', () => {
  it('normalizes credentials, creates a session, and strips secrets', async () => {
    const findForAuthentication = vi.fn().mockResolvedValue({
      _id: 'user-1',
      email: 'seller@example.com',
      passwordHash: await bcrypt.hash('secret123', 4),
      username: 'Seller',
      telephone: '123',
      tenantId: 'campus-market',
      tokenVersion: 2,
    });
    const sessionService = sessions();
    const { authenticate } = createAuthService(
      repository({ findForAuthentication }),
      sessionService,
    );

    const result = await authenticate(
      { email: ' Seller@Example.com ', password: 'secret123' },
      'campus-market',
      'test browser',
    );

    expect(findForAuthentication).toHaveBeenCalledWith(
      'campus-market',
      'seller@example.com',
    );
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('tokenVersion');
    expect(sessionService.createSession).toHaveBeenCalledWith(
      'user-1',
      'campus-market',
      2,
      'test browser',
      expect.any(Date),
    );
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('increments tokenVersion before revoking active sessions', async () => {
    const incrementTokenVersion = vi.fn().mockResolvedValue(true);
    const sessionService = sessions();
    const { logout } = createAuthService(
      repository({ incrementTokenVersion }),
      sessionService,
    );

    await logout('user-1', 'mercadozetta');

    expect(incrementTokenVersion).toHaveBeenCalledWith(
      'mercadozetta',
      'user-1',
    );
    expect(sessionService.revokeAllSessions).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      expect.any(Date),
    );
  });

  it('rejects logout when the authenticated user no longer exists', async () => {
    const { logout } = createAuthService(repository(), sessions());

    await expect(logout('missing', 'mercadozetta')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_AUTH_TOKEN',
    });
  });

  it('uses the same public error for missing users and invalid passwords', async () => {
    let { authenticate } = createAuthService(repository(), sessions());
    await expect(
      authenticate({ email: 'missing@example.com', password: 'secret123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    ({ authenticate } = createAuthService(
      repository({
        findForAuthentication: vi.fn().mockResolvedValue({
          _id: 'user-1',
          tenantId: 'mercadozetta',
          email: 'seller@example.com',
          passwordHash: await bcrypt.hash('secret123', 4),
          tokenVersion: 0,
        }),
      }),
      sessions(),
    ));
    await expect(
      authenticate({
        email: 'seller@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('restores public user data with an owned active session', async () => {
    const findPublicById = vi.fn().mockResolvedValue({
      _id: 'user-1',
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
    });
    const sessionService = sessions();
    const { getSessionState } = createAuthService(
      repository({ findPublicById }),
      sessionService,
    );

    await expect(
      getSessionState('session-1', 'user-1', 'mercadozetta'),
    ).resolves.toEqual({
      user: {
        _id: 'user-1',
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
      },
      session: { id: 'session-1' },
    });
    expect(findPublicById).toHaveBeenCalledWith('mercadozetta', 'user-1');
  });

  it('rejects session restoration when the user no longer exists', async () => {
    const { getSessionState } = createAuthService(repository(), sessions());

    await expect(
      getSessionState('session-1', 'user-1', 'mercadozetta'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_AUTH_TOKEN',
    });
  });
});
