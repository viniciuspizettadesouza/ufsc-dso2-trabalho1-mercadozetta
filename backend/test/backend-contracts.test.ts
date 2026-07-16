import { beforeEach, describe, expect, it, vi } from 'vitest';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('@/app');
const AuthController = require('@/controller/authController');
const authMiddleware = require('@/middleware/auth');
const csrfMiddleware = require('@/middleware/csrf');
const Product = require('@/model/product');
const routes = require('@/routes');
const security = require('@/config/security');
const Session = require('@/model/session');
const sessionService = require('@/services/sessionService');
const sessionSecurity = require('@/services/sessionSecurityService');
const AuthService = require('@/services/authService');
const User = require('@/model/user');

function findRoute(path: string, method: string) {
  return routes.stack.find(
    (layer: any) =>
      layer.route && layer.route.path === path && layer.route.methods[method],
  );
}

function createResponse(): {
  statusCode: number | null;
  body: NodeModule['exports'];
  status: (code: number) => ReturnType<typeof createResponse>;
  send: (payload: NodeModule['exports']) => ReturnType<typeof createResponse>;
} {
  return {
    statusCode: null,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: NodeModule['exports']) {
      this.body = payload;
      return this;
    },
  };
}

describe('app and route composition', () => {
  it('returns only public user and session metadata from login', async () => {
    const result = {
      user: { _id: 'user-1', email: 'seller@example.com' },
      session: { id: 'session-1' },
      accessToken: 'access',
      refreshToken: 'refresh',
      csrfToken: 'csrf',
    };
    vi.spyOn(AuthService, 'authenticate').mockResolvedValue(result);
    const res = {
      ...createResponse(),
      cookie: vi.fn(),
    };

    await AuthController.authenticate(
      {
        validated: {
          body: { email: 'seller@example.com', password: 'password123' },
        },
        tenant: { id: 'mercadozetta' },
        get: vi.fn().mockReturnValue('test browser'),
      },
      res,
    );

    expect(res.body).toEqual({ user: result.user, session: result.session });
    expect(res.body).not.toHaveProperty('token');
    expect(res.cookie).toHaveBeenCalledTimes(3);
  });

  it('mounts JSON middleware before routes', async () => {
    const response = await request(app)
      .post('/users')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
  });

  it('exposes canonical public and authenticated routes', () => {
    expect(findRoute('/', 'get')).toBeDefined();
    expect(findRoute('/health', 'get')).toBeDefined();
    expect(findRoute('/ready', 'get')).toBeDefined();
    expect(findRoute('/products', 'get')).toBeDefined();
    expect(findRoute('/products/:productId', 'get')).toBeDefined();
    expect(findRoute('/users/:userId', 'get')).toBeDefined();
    expect(findRoute('/users/:userId/products', 'get')).toBeDefined();
    expect(findRoute('/users', 'post')).toBeDefined();
    expect(findRoute('/auth/login', 'post')).toBeDefined();
    expect(findRoute('/auth/logout', 'post')).toBeDefined();
    expect(findRoute('/products', 'post')).toBeDefined();
  });

  it('protects product creation with auth middleware before the controller', () => {
    const productPostRoute = findRoute('/products', 'post');
    const handlers = productPostRoute.route.stack.map(
      (layer: any) => layer.handle.name,
    );

    expect(handlers).toEqual([
      'authMiddleware',
      'requireCsrf',
      'requestValidator',
      'wrappedHandler',
    ]);
  });

  it.each([
    ['/auth/logout', 'post'],
    ['/auth/logout/current', 'post'],
    ['/auth/sessions/:sessionId', 'delete'],
    ['/products', 'post'],
    ['/cart/items', 'put'],
    ['/cart/items/:productId', 'delete'],
    ['/watchlist/:productId', 'put'],
    ['/watchlist/:productId', 'delete'],
    ['/orders', 'post'],
    ['/orders/:orderId/status', 'patch'],
    ['/products/:productId/reviews', 'post'],
    ['/notifications/:notificationId', 'patch'],
  ])(
    'protects cookie-authenticated %s %s mutations from CSRF',
    (path, method) => {
      const handlers = findRoute(path, method).route.stack.map(
        (layer: any) => layer.handle.name,
      );

      expect(handlers[0]).toBe('authMiddleware');
      expect(handlers).toContain('requireCsrf');
      expect(handlers.indexOf('requireCsrf')).toBeGreaterThan(
        handlers.indexOf('authMiddleware'),
      );
    },
  );

  it('reports both MongoDB readiness states from the route contract', () => {
    const readyHandler = findRoute('/ready', 'get').route.stack[0].handle;
    const originalReadyState = mongoose.connection.readyState;

    mongoose.connection.readyState = 1;
    const connectedResponse = createResponse();
    readyHandler({}, connectedResponse);
    expect(connectedResponse.statusCode).toBe(200);
    expect(connectedResponse.body).toEqual({
      status: 'ready',
      checks: { mongodb: 'connected' },
    });

    mongoose.connection.readyState = 0;
    const disconnectedResponse = createResponse();
    readyHandler({}, disconnectedResponse);
    expect(disconnectedResponse.statusCode).toBe(503);
    expect(disconnectedResponse.body).toEqual({
      status: 'not_ready',
      checks: { mongodb: 'disconnected' },
    });

    mongoose.connection.readyState = originalReadyState;
  });
});

describe('auth middleware', () => {
  beforeEach(() => {
    process.env.JWT_SIGNING_KEYS = '{"current":"contract-test-secret"}';
    process.env.JWT_ACTIVE_KID = 'current';
    vi.spyOn(User, 'exists').mockResolvedValue({ _id: 'user-123' } as any);
    vi.spyOn(Session, 'exists').mockResolvedValue({
      _id: 'session-123',
    } as any);
  });

  it('requires an access cookie and ignores Authorization headers', async () => {
    const res = createResponse();
    const next = vi.fn();

    await authMiddleware({ headers: {} }, res, next);
    await authMiddleware(
      { headers: { authorization: 'Bearer ignored-token' } },
      res,
      next,
    );

    expect(res.statusCode).toBeNull();
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTH_TOKEN_REQUIRED',
        message: 'Authorization token is required',
      }),
    );
  });

  it('sets the authenticated identity for a valid active cookie session', async () => {
    const token = jwt.sign(
      {
        tenantId: 'mercadozetta',
        sid: '507f1f77bcf86cd799439011',
        tokenVersion: 0,
        typ: 'access',
      },
      'contract-test-secret',
      {
        keyid: 'current',
        subject: 'user-123',
        issuer: 'mercadozetta',
        audience: 'mercadozetta-api',
      },
    );
    const req: any = {
      headers: {},
      cookies: { mz_at: token },
      tenant: { id: 'mercadozetta' },
    };
    const res = createResponse();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(req.userId).toBe('user-123');
    expect(req.sessionId).toBe('507f1f77bcf86cd799439011');
    expect(res.statusCode).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an invalid access cookie', async () => {
    const res = createResponse();
    const next = vi.fn();

    await authMiddleware(
      { headers: {}, cookies: { mz_at: 'invalid-token' } },
      res,
      next,
    );

    expect(res.statusCode).toBeNull();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_AUTH_TOKEN',
        message: 'Invalid authorization token',
      }),
    );
  });

  it('rejects access cookies with missing or unknown key ids', async () => {
    const payload = {
      tenantId: 'mercadozetta',
      sid: '507f1f77bcf86cd799439011',
      tokenVersion: 0,
      typ: 'access',
    };
    const next = vi.fn();
    const tokens = [
      jwt.sign(payload, 'contract-test-secret', {
        subject: 'user-123',
        issuer: 'mercadozetta',
        audience: 'mercadozetta-api',
      }),
      jwt.sign(payload, 'removed-secret', {
        keyid: 'removed',
        subject: 'user-123',
        issuer: 'mercadozetta',
        audience: 'mercadozetta-api',
      }),
    ];

    for (const token of tokens) {
      await authMiddleware(
        { headers: {}, cookies: { mz_at: token } },
        createResponse(),
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });
});

describe('cookie CSRF contract', () => {
  function requestWith(
    headers: Record<string, string> = {},
    cookies: Record<string, string> = {},
  ) {
    const normalized = Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [
        name.toLowerCase(),
        value,
      ]),
    );
    return {
      cookies,
      get(name: string) {
        return normalized[name.toLowerCase()];
      },
    };
  }

  it('parses and allowlists origins and compares double-submit values', () => {
    process.env.CORS_ORIGIN = 'https://shop.example';

    expect(
      csrfMiddleware.getRequestOrigin(
        requestWith({ Origin: 'https://shop.example' }),
      ),
    ).toBe('https://shop.example');
    expect(
      csrfMiddleware.getRequestOrigin(
        requestWith({ Referer: 'https://shop.example/path' }),
      ),
    ).toBe('https://shop.example');
    expect(csrfMiddleware.getRequestOrigin(requestWith())).toBeNull();
    expect(
      csrfMiddleware.getRequestOrigin(requestWith({ Referer: 'invalid' })),
    ).toBeNull();
    expect(
      csrfMiddleware.hasAllowedOrigin(
        requestWith({ Origin: 'https://shop.example' }),
      ),
    ).toBe(true);
    expect(
      csrfMiddleware.hasAllowedOrigin(
        requestWith({ Origin: 'https://attacker.example' }),
      ),
    ).toBe(false);
    expect(csrfMiddleware.valuesMatch('same', 'same')).toBe(true);
    expect(csrfMiddleware.valuesMatch('same', 'diff')).toBe(false);
    expect(csrfMiddleware.valuesMatch('short', 'longer')).toBe(false);
  });

  it('enforces allowed Origin and a session-bound CSRF proof for cookies', () => {
    process.env.CORS_ORIGIN = 'https://shop.example';
    const sessionId = '507f1f77bcf86cd799439011';
    const proof = sessionSecurity.createCsrfToken(sessionId);
    const refresh = sessionSecurity.createRefreshToken(sessionId);
    const next = vi.fn();
    const valid = requestWith(
      {
        Origin: 'https://shop.example',
        'X-CSRF-Token': proof,
      },
      { mz_csrf: proof, mz_rt: refresh },
    );

    csrfMiddleware.requireAllowedOrigin(valid, {}, next);
    csrfMiddleware.requireAllowedOrigin(requestWith(), {}, next);
    csrfMiddleware.validatePresentOrigin(requestWith(), {}, next);
    csrfMiddleware.validatePresentOrigin(valid, {}, next);
    csrfMiddleware.validatePresentOrigin(
      requestWith({ Referer: 'https://shop.example/path' }),
      {},
      next,
    );
    csrfMiddleware.requireCsrf(valid, {}, next);
    csrfMiddleware.requireCsrf(
      requestWith(
        { Origin: 'https://shop.example' },
        { mz_csrf: proof, mz_rt: refresh },
      ),
      {},
      next,
    );
    csrfMiddleware.requireCsrf(
      requestWith(
        {
          Origin: 'https://shop.example',
          'X-CSRF-Token': `${proof.slice(0, -1)}x`,
        },
        { mz_csrf: `${proof.slice(0, -1)}x`, mz_rt: refresh },
      ),
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_ORIGIN' }),
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_CSRF_TOKEN' }),
    );
  });
});

describe('session security contract branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects malformed, missing, and expired refresh sessions', async () => {
    await expect(
      sessionService.rotateSession('malformed', 'mercadozetta', new Date()),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    const select = vi.fn().mockResolvedValueOnce(null);
    vi.spyOn(Session, 'findOne').mockReturnValueOnce({ select } as any);
    await expect(
      sessionService.rotateSession(
        sessionSecurity.createRefreshToken('507f1f77bcf86cd799439011'),
        'mercadozetta',
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    select.mockResolvedValueOnce({
      _id: '507f1f77bcf86cd799439011',
      tenantId: 'mercadozetta',
      userId: '507f1f77bcf86cd799439010',
      tokenVersion: 0,
      refreshTokenHash: 'hash',
      expiresAt: new Date(0),
      absoluteExpiresAt: new Date(0),
    });
    vi.spyOn(Session, 'findOne').mockReturnValueOnce({ select } as any);
    await expect(
      sessionService.rotateSession(
        sessionSecurity.createRefreshToken('507f1f77bcf86cd799439011'),
        'mercadozetta',
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('loads active sessions and rejects missing or revoked records', async () => {
    const active = {
      _id: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000),
    };
    vi.spyOn(Session, 'findOne')
      .mockResolvedValueOnce(active as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...active, revokedAt: new Date() } as any);

    await expect(
      sessionService.getSession(
        String(active._id),
        'user-1',
        'mercadozetta',
        new Date(),
      ),
    ).resolves.toMatchObject({ id: String(active._id) });
    await expect(
      sessionService.getSession(
        String(active._id),
        'user-1',
        'mercadozetta',
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AUTH_TOKEN' });
    await expect(
      sessionService.getSession(
        String(active._id),
        'user-1',
        'mercadozetta',
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AUTH_TOKEN' });
  });

  it('accepts and rejects tenant-owned revocation targets', async () => {
    vi.spyOn(Session, 'updateOne')
      .mockResolvedValueOnce({ matchedCount: 1 } as any)
      .mockResolvedValueOnce({ matchedCount: 0 } as any);

    await expect(
      sessionService.revokeSession(
        '507f1f77bcf86cd799439011',
        'user-1',
        'mercadozetta',
        'user_revoked',
        new Date(),
      ),
    ).resolves.toBeUndefined();
    await expect(
      sessionService.revokeSession(
        '507f1f77bcf86cd799439011',
        'user-1',
        'mercadozetta',
        'user_revoked',
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('covers local and production session configuration decisions', () => {
    const originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    delete process.env.REFRESH_TOKEN_HASH_SECRETS;
    delete process.env.CSRF_SECRETS;
    delete process.env.SESSION_ACCESS_TOKEN_TTL_MS;
    expect(security.getRefreshTokenHashKeyRing().activeVersion).toBe('local');
    expect(security.getSessionSecurityConfig().accessTokenTtlMs).toBe(300000);
    expect(security.getAuthCookieConfig().access.name).toBe('mz_at');

    process.env.NODE_ENV = 'production';
    process.env.REFRESH_TOKEN_HASH_SECRETS = '{"current":"refresh-secret"}';
    process.env.REFRESH_TOKEN_HASH_ACTIVE_VERSION = 'current';
    process.env.CSRF_SECRETS = '{"current":"csrf-secret"}';
    process.env.CSRF_ACTIVE_VERSION = 'current';
    process.env.SESSION_ACCESS_TOKEN_TTL_MS = '60000';
    expect(security.getRefreshTokenHashKeyRing().activeVersion).toBe('current');
    expect(security.getSessionSecurityConfig().accessTokenTtlMs).toBe(60000);
    expect(security.getAuthCookieConfig().access.name).toBe('__Host-mz_at');

    process.env = originalEnv;
  });
});

describe('model contracts', () => {
  it('keeps user password excluded by default', () => {
    expect(User.schema.path('password').options.select).toBe(false);
  });

  it('keeps the session version excluded by default', () => {
    expect(User.schema.path('tokenVersion').options).toMatchObject({
      default: 0,
      required: true,
      select: false,
    });
  });

  it('keeps tenant-aware user email uniqueness', () => {
    expect(User.schema.indexes()).toContainEqual([
      { tenantId: 1, email: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('hashes user password before save when password changes', async () => {
    const passwordHook = User.schema.s.hooks._pres
      .get('save')
      .find((hook: any) => hook.fn.toString().includes('isModified'));
    const hashSpy = vi.spyOn(bcrypt, 'hash');
    const doc = {
      password: 'plain-secret',
      isModified: vi.fn(() => true),
    };

    await passwordHook.fn.call(doc);

    expect(doc.isModified).toHaveBeenCalledWith('password');
    expect(hashSpy).toHaveBeenCalledWith('plain-secret', 10);
    expect(doc.password).not.toBe('plain-secret');
    expect(await bcrypt.compare('plain-secret', doc.password)).toBe(true);

    hashSpy.mockRestore();
  });

  it('does not rehash unchanged user passwords', async () => {
    const passwordHook = User.schema.s.hooks._pres
      .get('save')
      .find((hook: any) => hook.fn.toString().includes('isModified'));
    const hashSpy = vi.spyOn(bcrypt, 'hash');
    const doc = {
      password: 'already-hashed',
      isModified: vi.fn(() => false),
    };

    await passwordHook.fn.call(doc);

    expect(doc.password).toBe('already-hashed');
    expect(hashSpy).not.toHaveBeenCalled();

    hashSpy.mockRestore();
  });

  it('requires product name, inventory, image, and seller', async () => {
    const product = new Product({});

    await expect(product.validate()).rejects.toMatchObject({
      errors: {
        name: expect.any(Object),
        inventory: expect.any(Object),
        image: expect.any(Object),
        seller: expect.any(Object),
      },
    });
  });

  it('restricts products to known statuses', () => {
    expect(Product.schema.path('status').enumValues).toEqual([
      'draft',
      'active',
      'paused',
      'sold_out',
      'archived',
    ]);
    expect(Product.schema.path('status').defaultValue).toBe('active');
  });

  it('keeps product tenant indexes and timestamps', () => {
    expect(Product.schema.indexes()).toContainEqual([
      { tenantId: 1, seller: 1 },
      expect.any(Object),
    ]);
    expect(Product.schema.indexes()).toContainEqual([
      { tenantId: 1, category: 1, subcategory: 1 },
      expect.any(Object),
    ]);
    expect(Product.schema.indexes()).toContainEqual([
      { tenantId: 1, name: 'text', description: 'text' },
      expect.any(Object),
    ]);
    expect(Product.schema.options.timestamps).toBe(true);
  });
});
