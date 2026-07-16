import { afterEach, describe, expect, it, vi } from 'vitest';
import AppError from '@/errors/AppError';
import { clearModules, mockModule } from '../helpers/moduleMock';

const controllerPath = require.resolve('@/controller/authController');
const cookieServicePath = require.resolve('@/services/authCookieService');
const servicePath = require.resolve('@/services/authService');
const sessionServicePath = require.resolve('@/services/sessionService');

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
}

function loadController(
  overrides: Record<string, ReturnType<typeof vi.fn>> = {},
) {
  const dependencies = {
    authenticate: vi.fn(),
    clearAuthCookies: vi.fn(),
    getSessionState: vi.fn(),
    listSessions: vi.fn(),
    logout: vi.fn(),
    revokeSession: vi.fn(),
    rotateSession: vi.fn(),
    setAuthCookies: vi.fn(),
    ...overrides,
  };
  clearModules(
    controllerPath,
    cookieServicePath,
    servicePath,
    sessionServicePath,
  );
  mockModule(cookieServicePath, {
    setAuthCookies: dependencies.setAuthCookies,
    clearAuthCookies: dependencies.clearAuthCookies,
  });
  mockModule(servicePath, {
    authenticate: dependencies.authenticate,
    getSessionState: dependencies.getSessionState,
    logout: dependencies.logout,
  });
  mockModule(sessionServicePath, {
    listSessions: dependencies.listSessions,
    revokeSession: dependencies.revokeSession,
    rotateSession: dependencies.rotateSession,
  });
  return { controller: require('@/controller/authController'), dependencies };
}

afterEach(() => {
  clearModules(
    controllerPath,
    cookieServicePath,
    servicePath,
    sessionServicePath,
  );
});

describe('authController', () => {
  it('authenticates with validated body and tenant id', async () => {
    const result = {
      user: { email: 'seller@example.com' },
      session: { id: 'session-1' },
    };
    const authenticate = vi.fn().mockResolvedValue(result);
    const { controller, dependencies } = loadController({ authenticate });
    const req = {
      validated: {
        body: { email: 'seller@example.com', password: 'secret123' },
      },
      tenant: { id: 'mercadozetta' },
      get: vi.fn().mockReturnValue('test browser'),
    };
    const res = createResponse();

    await controller.authenticate(req, res);

    expect(authenticate).toHaveBeenCalledWith(
      req.validated.body,
      'mercadozetta',
      'test browser',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(result);
    expect(dependencies.setAuthCookies).toHaveBeenCalledWith(res, result);
  });

  it('revokes the authenticated session and returns no content', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const { controller, dependencies } = loadController({ logout });
    const req = { userId: 'user-1', tenant: { id: 'mercadozetta' } };
    const res = createResponse();

    await controller.logout(req, res);

    expect(logout).toHaveBeenCalledWith('user-1', 'mercadozetta');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(dependencies.clearAuthCookies).toHaveBeenCalledWith(res);
  });

  it('restores only a cookie-backed session', async () => {
    const getSessionState = vi.fn().mockResolvedValue({
      user: { _id: 'user-1' },
      session: { id: 'session-1' },
    });
    let loaded = loadController({ getSessionState });
    const res = createResponse();

    await expect(
      loaded.controller.session({ userId: 'user-1' }, res),
    ).rejects.toMatchObject({ code: 'COOKIE_SESSION_REQUIRED' });

    loaded = loadController({ getSessionState });
    await loaded.controller.session(
      {
        sessionId: 'session-1',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );

    expect(getSessionState).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      'mercadozetta',
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rotates cookies, clears failed sessions, and preserves concurrency responses', async () => {
    const successfulRotation = {
      accessToken: 'access',
      refreshToken: 'refresh-next',
      csrfToken: 'csrf-next',
      session: { expiresAt: new Date() },
    };
    let rotateSession = vi.fn().mockResolvedValue(successfulRotation);
    let loaded = loadController({ rotateSession });
    const req = {
      cookies: { mz_rt: 'refresh-current' },
      tenant: { id: 'mercadozetta' },
    };
    const res = createResponse();

    await loaded.controller.refresh(req, res);
    expect(rotateSession).toHaveBeenCalledWith(
      'refresh-current',
      'mercadozetta',
      expect.any(Date),
    );
    expect(loaded.dependencies.setAuthCookies).toHaveBeenCalledWith(
      res,
      successfulRotation,
    );

    const unauthorized = Object.assign(new Error('expired'), {
      statusCode: 401,
      code: 'SESSION_EXPIRED',
    });
    Object.setPrototypeOf(unauthorized, require('@/errors/AppError').prototype);
    rotateSession = vi.fn().mockRejectedValue(unauthorized);
    loaded = loadController({ rotateSession });
    await expect(
      loaded.controller.refresh(
        { cookies: {}, tenant: { id: 'mercadozetta' } },
        res,
      ),
    ).rejects.toBe(unauthorized);
    expect(rotateSession).toHaveBeenCalledWith(
      '',
      'mercadozetta',
      expect.any(Date),
    );
    expect(loaded.dependencies.clearAuthCookies).toHaveBeenCalledWith(res);

    const conflict = Object.assign(new Error('conflict'), { statusCode: 409 });
    rotateSession = vi.fn().mockRejectedValue(conflict);
    loaded = loadController({ rotateSession });
    await expect(loaded.controller.refresh(req, res)).rejects.toBe(conflict);
    expect(loaded.dependencies.clearAuthCookies).not.toHaveBeenCalled();
  });

  it('lists and revokes only sessions owned by the authenticated tenant/user', async () => {
    const listSessions = vi.fn().mockResolvedValue([{ id: 'session-1' }]);
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    const loaded = loadController({ listSessions, revokeSession });
    const res = createResponse();

    await loaded.controller.sessions(
      { userId: 'user-1', tenant: { id: 'mercadozetta' } },
      res,
    );
    expect(listSessions).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      expect.any(Date),
    );
    expect(res.send).toHaveBeenCalledWith({
      sessions: [{ id: 'session-1' }],
    });

    await loaded.controller.revokeSession(
      {
        params: { sessionId: 'session-1' },
        sessionId: 'session-1',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );
    expect(revokeSession).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      'mercadozetta',
      'user_revoked',
      expect.any(Date),
    );
    expect(loaded.dependencies.clearAuthCookies).toHaveBeenCalledWith(res);

    loaded.dependencies.clearAuthCookies.mockClear();
    await loaded.controller.revokeSession(
      {
        params: {},
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );
    expect(revokeSession).toHaveBeenLastCalledWith(
      'undefined',
      'user-1',
      'mercadozetta',
      'user_revoked',
      expect.any(Date),
    );
    expect(loaded.dependencies.clearAuthCookies).not.toHaveBeenCalled();
  });

  it('requires and revokes the current cookie session', async () => {
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    let loaded = loadController({ revokeSession });
    const res = createResponse();

    await expect(
      loaded.controller.logoutCurrent({ userId: 'user-1' }, res),
    ).rejects.toMatchObject({ code: 'COOKIE_SESSION_REQUIRED' });

    loaded = loadController({ revokeSession });
    await loaded.controller.logoutCurrent(
      {
        sessionId: 'session-1',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );
    expect(revokeSession).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      'mercadozetta',
      'current_session_logout',
      expect.any(Date),
    );
    expect(loaded.dependencies.clearAuthCookies).toHaveBeenCalledWith(res);
  });

  it('covers the complete controller decision tree in one instance', async () => {
    const successfulRotation = {
      accessToken: 'access',
      refreshToken: 'refresh-next',
      csrfToken: 'csrf-next',
      session: { id: 'session-1', expiresAt: new Date() },
    };
    const unauthorized = new AppError(401, 'SESSION_EXPIRED', 'Expired');
    const conflict = new AppError(
      409,
      'REFRESH_ALREADY_ROTATED',
      'Already rotated',
    );
    const dependencies = {
      authenticate: vi.fn().mockResolvedValue({
        user: { _id: 'user-1' },
        ...successfulRotation,
      }),
      getSessionState: vi
        .fn()
        .mockResolvedValue({ user: { _id: 'user-1' }, session: { id: 's' } }),
      listSessions: vi.fn().mockResolvedValue([{ id: 'session-1' }]),
      logout: vi.fn().mockResolvedValue(undefined),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      rotateSession: vi
        .fn()
        .mockResolvedValueOnce(successfulRotation)
        .mockRejectedValueOnce(unauthorized)
        .mockRejectedValueOnce(conflict),
    };
    const loaded = loadController(dependencies);
    const { controller } = loaded;
    const res = createResponse();

    await controller.authenticate(
      {
        validated: { body: { email: 'a@b.com', password: 'password123' } },
        tenant: { id: 'mercadozetta' },
        get: vi.fn().mockReturnValue(undefined),
      },
      res,
    );

    await expect(controller.session({}, res)).rejects.toMatchObject({
      code: 'COOKIE_SESSION_REQUIRED',
    });
    await controller.session(
      {
        sessionId: 'session-1',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );

    await controller.refresh(
      { cookies: { mz_rt: 'refresh-current' }, tenant: { id: 'mercadozetta' } },
      res,
    );
    await expect(
      controller.refresh({ cookies: {}, tenant: { id: 'mercadozetta' } }, res),
    ).rejects.toBe(unauthorized);
    await expect(
      controller.refresh(
        { cookies: { mz_rt: 123 }, tenant: { id: 'mercadozetta' } },
        res,
      ),
    ).rejects.toBe(conflict);

    await controller.sessions(
      { userId: 'user-1', tenant: { id: 'mercadozetta' } },
      res,
    );
    await controller.revokeSession(
      {
        params: { sessionId: 'session-1' },
        sessionId: 'session-1',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );
    await controller.revokeSession(
      {
        params: {},
        sessionId: 'different-session',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );

    await expect(controller.logoutCurrent({}, res)).rejects.toMatchObject({
      code: 'COOKIE_SESSION_REQUIRED',
    });
    await controller.logoutCurrent(
      {
        sessionId: 'session-1',
        userId: 'user-1',
        tenant: { id: 'mercadozetta' },
      },
      res,
    );
    await controller.logout(
      { userId: 'user-1', tenant: { id: 'mercadozetta' } },
      res,
    );

    expect(dependencies.getSessionState).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      'mercadozetta',
    );
    expect(dependencies.listSessions).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      expect.any(Date),
    );
    expect(dependencies.logout).toHaveBeenCalledWith('user-1', 'mercadozetta');
    expect(loaded.dependencies.clearAuthCookies).toHaveBeenCalled();
    expect(loaded.dependencies.setAuthCookies).toHaveBeenCalled();
  });
});
