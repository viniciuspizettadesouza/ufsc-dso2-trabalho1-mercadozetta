import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const servicePath = require.resolve('@/services/authService');
const securityPath = require.resolve('@/config/security');
const sessionServicePath = require.resolve('@/services/sessionService');
const userModelPath = require.resolve('@/model/user');

function loadAuthService(
  userModel: NodeModule['exports'],
  _secret = 'unused',
  sessionService: NodeModule['exports'] = {},
) {
  clearModules(servicePath, securityPath, sessionServicePath, userModelPath);
  mockModule(userModelPath, userModel);
  mockModule(securityPath, {});
  mockModule(sessionServicePath, {
    createSession: vi.fn().mockResolvedValue({
      accessToken: 'cookie-access-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
      session: { id: 'session-1' },
    }),
    getSession: vi.fn(),
    revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    ...sessionService,
  });
  return require('@/services/authService');
}

afterEach(() => {
  clearModules(servicePath, securityPath, sessionServicePath, userModelPath);
  vi.restoreAllMocks();
});

describe('authService', () => {
  it('normalizes email, verifies password, creates a session, and strips passwords', async () => {
    const user = {
      _id: 'user-1',
      email: 'seller@example.com',
      password: await bcrypt.hash('secret123', 4),
      username: 'Seller',
      telephone: '123',
      tenantId: 'mercadozetta',
      tokenVersion: 2,
      toObject() {
        return {
          _id: this._id,
          email: this.email,
          password: this.password,
          username: this.username,
          telephone: this.telephone,
          tenantId: this.tenantId,
          tokenVersion: this.tokenVersion,
        };
      },
    };
    const select = vi.fn().mockResolvedValue(user);
    const findOne = vi.fn(() => ({ select }));
    const createSession = vi.fn().mockResolvedValue({
      accessToken: 'cookie-access-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
      session: { id: 'session-1' },
    });
    const { authenticate } = loadAuthService({ findOne }, 'unit-test-secret', {
      createSession,
    });

    const result = await authenticate(
      {
        email: ' Seller@Example.com ',
        password: 'secret123',
      },
      'campus-market',
      'test browser',
    );

    expect(findOne).toHaveBeenCalledWith({
      tenantId: 'campus-market',
      email: 'seller@example.com',
    });
    expect(select).toHaveBeenCalledWith(
      '+password +tokenVersion email username telephone tenantId',
    );
    expect(result.user.password).toBeUndefined();
    expect(result.user.tokenVersion).toBeUndefined();
    expect(result).not.toHaveProperty('token');
    expect(createSession).toHaveBeenCalledWith(
      'user-1',
      'campus-market',
      2,
      'test browser',
      expect.any(Date),
    );
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('increments the token version to revoke active sessions', async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    const revokeAllSessions = vi.fn().mockResolvedValue(undefined);
    const { logout } = loadAuthService({ updateOne }, 'unit-test-secret', {
      revokeAllSessions,
    });

    await logout('user-1', 'mercadozetta');

    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'user-1', tenantId: 'mercadozetta' },
      { $inc: { tokenVersion: 1 } },
    );
    expect(revokeAllSessions).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      expect.any(Date),
    );
  });

  it('rejects logout when the authenticated user no longer exists', async () => {
    const { logout } = loadAuthService({
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 }),
    });

    await expect(logout('missing', 'mercadozetta')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_AUTH_TOKEN',
    });
  });

  it('rejects missing users and invalid passwords with the same public error', async () => {
    let { authenticate } = loadAuthService({
      findOne: vi.fn(() => ({ select: vi.fn().mockResolvedValue(null) })),
    });

    await expect(
      authenticate({
        email: 'missing@example.com',
        password: 'secret123',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });

    const hashedPassword = await bcrypt.hash('secret123', 4);
    ({ authenticate } = loadAuthService({
      findOne: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          _id: 'user-1',
          email: 'seller@example.com',
          password: hashedPassword,
        }),
      })),
    }));

    await expect(
      authenticate({
        email: 'seller@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('restores public user data with an owned active session', async () => {
    const getSession = vi.fn().mockResolvedValue({ id: 'session-1' });
    const user = {
      toObject: () => ({
        _id: 'user-1',
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        password: 'not-selected',
        tokenVersion: 2,
      }),
    };
    const findOne = vi.fn(() => ({ select: vi.fn().mockResolvedValue(user) }));
    const { getSessionState } = loadAuthService(
      { findOne },
      'unit-test-secret',
      { getSession },
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
    expect(getSession).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      'mercadozetta',
      expect.any(Date),
    );
  });

  it('rejects session restoration when the user no longer exists', async () => {
    const { getSessionState } = loadAuthService(
      {
        findOne: vi.fn(() => ({ select: vi.fn().mockResolvedValue(null) })),
      },
      'unit-test-secret',
      { getSession: vi.fn().mockResolvedValue({ id: 'session-1' }) },
    );

    await expect(
      getSessionState('session-1', 'user-1', 'mercadozetta'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_AUTH_TOKEN',
    });
  });
});
