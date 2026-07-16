import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const authPath = require.resolve('@/middleware/auth');
const securityPath = require.resolve('@/config/security');
const sessionModelPath = require.resolve('@/model/session');
const sessionServicePath = require.resolve('@/services/sessionService');
const userModelPath = require.resolve('@/model/user');

function loadAuthMiddleware(
  userExists = vi.fn().mockResolvedValue({ _id: 'user-1' }),
  sessionExists = vi.fn().mockResolvedValue({ _id: 'session-1' }),
  signingKeys: Record<string, string> = { current: 'current-secret' },
) {
  clearModules(
    authPath,
    securityPath,
    sessionModelPath,
    sessionServicePath,
    userModelPath,
  );
  mockModule(securityPath, {
    getJwtSigningKeyRing: () => ({ activeKid: 'current', keys: signingKeys }),
    getAuthCookieConfig: () => ({ access: { name: 'mz_at' } }),
  });
  mockModule(sessionModelPath, { exists: sessionExists });
  mockModule(sessionServicePath, {
    accessTokenContract: {
      issuer: 'mercadozetta',
      audience: 'mercadozetta-api',
    },
  });
  mockModule(userModelPath, { exists: userExists });
  return require('@/middleware/auth');
}

const validPayload = {
  tenantId: 'mercadozetta',
  sid: '507f1f77bcf86cd799439011',
  tokenVersion: 2,
  typ: 'access',
};

function signCookie(
  payload: object = validPayload,
  secret = 'current-secret',
  kid: string | number | undefined = 'current',
  subject = 'user-1',
) {
  return jwt.sign(payload, secret, {
    ...(kid === undefined ? {} : { header: { kid } as any }),
    subject,
    issuer: 'mercadozetta',
    audience: 'mercadozetta-api',
  });
}

function cookieRequest(token: string, tenantId = 'mercadozetta') {
  return {
    headers: {},
    cookies: { mz_at: token },
    tenant: { id: tenantId },
  };
}

afterEach(() => {
  clearModules(
    authPath,
    securityPath,
    sessionModelPath,
    sessionServicePath,
    userModelPath,
  );
  vi.restoreAllMocks();
});

describe('auth middleware', () => {
  it('requires the access cookie and does not accept Authorization headers', async () => {
    const authMiddleware = loadAuthMiddleware();
    const next = vi.fn();

    await authMiddleware({ headers: {} }, {}, next);
    await authMiddleware(
      { headers: { authorization: `Bearer ${signCookie()}` } },
      {},
      next,
    );

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: 'AUTH_TOKEN_REQUIRED' }),
    );
  });

  it('authenticates a tenant-bound active cookie session', async () => {
    const userExists = vi.fn().mockResolvedValue({ _id: 'user-1' });
    const sessionExists = vi.fn().mockResolvedValue({ _id: 'session-1' });
    const authMiddleware = loadAuthMiddleware(userExists, sessionExists);
    const req: any = cookieRequest(signCookie());
    const next = vi.fn();

    await authMiddleware(req, {}, next);

    expect(req.userId).toBe('user-1');
    expect(req.sessionId).toBe(validPayload.sid);
    expect(sessionExists).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: validPayload.sid,
        userId: 'user-1',
        tenantId: 'mercadozetta',
        tokenVersion: 2,
      }),
    );
    expect(userExists).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'user-1', tenantId: 'mercadozetta' }),
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts retained signing keys and rejects unknown or malformed key ids', async () => {
    const authMiddleware = loadAuthMiddleware(undefined, undefined, {
      current: 'current-secret',
      previous: 'previous-secret',
    });
    const next = vi.fn();

    for (const token of [
      signCookie(validPayload, 'previous-secret', 'previous'),
      signCookie(validPayload, 'removed-secret', 'removed'),
      signCookie(validPayload, 'current-secret', 1),
      signCookie(validPayload, 'current-secret', undefined),
    ]) {
      await authMiddleware(cookieRequest(token), {}, next);
    }

    expect(next.mock.calls[0]).toEqual([]);
    expect(next).toHaveBeenCalledTimes(4);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });

  it('rejects invalid claims, tenant, signature, issuer, and expiry', async () => {
    const authMiddleware = loadAuthMiddleware();
    const next = vi.fn();
    const tokens = [
      signCookie({ ...validPayload, typ: 'refresh' }),
      signCookie(validPayload, 'current-secret', 'current', ''),
      signCookie({ ...validPayload, sid: undefined }),
      signCookie({ ...validPayload, tenantId: undefined }),
      signCookie({ ...validPayload, tokenVersion: '2' }),
      signCookie({ ...validPayload, tenantId: 'campus-market' }),
      signCookie(validPayload, 'wrong-secret'),
      jwt.sign(validPayload, 'current-secret', {
        keyid: 'current',
        subject: 'user-1',
        issuer: 'wrong-issuer',
        audience: 'mercadozetta-api',
      }),
      jwt.sign(validPayload, 'current-secret', {
        keyid: 'current',
        subject: 'user-1',
        issuer: 'mercadozetta',
        audience: 'mercadozetta-api',
        expiresIn: -1,
      }),
      'invalid-token',
    ];

    for (const token of tokens) {
      await authMiddleware(cookieRequest(token), {}, next);
    }

    expect(next).toHaveBeenCalledTimes(tokens.length);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });

  it('rejects inactive server sessions and revoked users', async () => {
    const next = vi.fn();
    await loadAuthMiddleware(undefined, vi.fn().mockResolvedValue(null))(
      cookieRequest(signCookie()),
      {},
      next,
    );
    await loadAuthMiddleware(
      vi.fn().mockResolvedValue(null),
      vi.fn().mockResolvedValue({ _id: 'session-1' }),
    )(cookieRequest(signCookie()), {}, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });
});
