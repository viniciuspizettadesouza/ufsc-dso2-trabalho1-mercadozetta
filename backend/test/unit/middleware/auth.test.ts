import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const authPath = require.resolve('@/middleware/auth');
const securityPath = require.resolve('@/config/security');
const userModelPath = require.resolve('@/model/user');

function loadAuthMiddleware(
  secret = 'test-secret',
  exists = vi.fn().mockResolvedValue({ _id: 'user-1' }),
) {
  clearModules(authPath, securityPath, userModelPath);
  mockModule(securityPath, {
    getJwtSecret: () => secret,
  });
  mockModule(userModelPath, { exists });
  return require('@/middleware/auth');
}

afterEach(() => {
  clearModules(authPath, securityPath, userModelPath);
  vi.restoreAllMocks();
});

describe('auth middleware', () => {
  it('covers the complete token decision tree in one middleware instance', async () => {
    const exists = vi.fn().mockResolvedValue({ _id: 'user-1' });
    const authMiddleware = loadAuthMiddleware('test-secret', exists);
    const next = vi.fn();
    const invoke = (authorization?: string, tenant?: { id: string }) =>
      authMiddleware(
        {
          headers: authorization ? { authorization } : {},
          tenant,
        },
        {},
        next,
      );
    const sign = (payload: object) =>
      `Bearer ${jwt.sign(payload, 'test-secret')}`;

    await invoke();
    await invoke('Token invalid');
    await invoke(sign({ id: '', tenantId: 'mercadozetta', tokenVersion: 1 }));
    await invoke(sign({ id: 'user-1', tokenVersion: 1 }));
    await invoke(sign({ id: 'user-1', tenantId: 'mercadozetta' }));
    await invoke(
      sign({ id: 'user-1', tenantId: 'campus-market', tokenVersion: 1 }),
      { id: 'mercadozetta' },
    );

    await invoke(
      sign({ id: 'user-1', tenantId: 'mercadozetta', tokenVersion: 0 }),
      { id: 'mercadozetta' },
    );
    expect(exists).toHaveBeenLastCalledWith({
      _id: 'user-1',
      tenantId: 'mercadozetta',
      $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }],
    });

    await invoke(
      sign({ id: 'user-1', tenantId: 'mercadozetta', tokenVersion: 2 }),
    );
    expect(exists).toHaveBeenLastCalledWith({
      _id: 'user-1',
      tenantId: 'mercadozetta',
      tokenVersion: 2,
    });

    exists.mockResolvedValueOnce(null);
    await invoke(
      sign({ id: 'user-1', tenantId: 'mercadozetta', tokenVersion: 2 }),
    );
    await invoke('Bearer invalid-token');

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });

  it('rejects missing authorization headers', () => {
    const authMiddleware = loadAuthMiddleware();
    const next = vi.fn();

    authMiddleware({ headers: {} }, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTH_TOKEN_REQUIRED',
      }),
    );
  });

  it('rejects malformed authorization headers', () => {
    const authMiddleware = loadAuthMiddleware();
    const next = vi.fn();

    authMiddleware({ headers: { authorization: 'Token abc' } }, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_AUTH_FORMAT',
      }),
    );
  });

  it('sets req.userId for valid active sessions', async () => {
    const authMiddleware = loadAuthMiddleware();
    const token = jwt.sign(
      { id: 'user-1', tenantId: 'mercadozetta', tokenVersion: 0 },
      'test-secret',
    );
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      tenant: { id: 'mercadozetta' },
    };
    const next = vi.fn();

    await authMiddleware(req, {}, next);

    expect(req.userId).toBe('user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects valid tokens from another tenant', async () => {
    const authMiddleware = loadAuthMiddleware();
    const token = jwt.sign(
      { id: 'user-1', tenantId: 'campus-market', tokenVersion: 0 },
      'test-secret',
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
      tenant: { id: 'mercadozetta' },
    };
    const next = vi.fn();

    await authMiddleware(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_AUTH_TOKEN',
      }),
    );
  });

  it('rejects signed tokens without a valid user id', async () => {
    const authMiddleware = loadAuthMiddleware();
    const next = vi.fn();

    for (const payload of [
      { tenantId: 'mercadozetta' },
      { id: '' },
      { id: 123 },
    ]) {
      const token = jwt.sign(payload, 'test-secret');
      await authMiddleware(
        {
          headers: { authorization: `Bearer ${token}` },
          tenant: { id: 'mercadozetta' },
        },
        {},
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(3);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_AUTH_TOKEN',
      }),
    );
  });

  it('rejects expired tokens', async () => {
    const authMiddleware = loadAuthMiddleware();
    const token = jwt.sign({ id: 'user-1' }, 'test-secret', { expiresIn: -1 });
    const next = vi.fn();

    await authMiddleware(
      { headers: { authorization: `Bearer ${token}` } },
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_AUTH_TOKEN',
      }),
    );
  });

  it('rejects tokens without tenant or session version claims', async () => {
    const authMiddleware = loadAuthMiddleware();
    const next = vi.fn();

    for (const payload of [
      { id: 'user-1', tokenVersion: 0 },
      { id: 'user-1', tenantId: 'mercadozetta' },
    ]) {
      const token = jwt.sign(payload, 'test-secret');
      await authMiddleware(
        {
          headers: { authorization: `Bearer ${token}` },
          tenant: { id: 'mercadozetta' },
        },
        {},
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });

  it('rejects revoked token versions', async () => {
    const exists = vi.fn().mockResolvedValue(null);
    const authMiddleware = loadAuthMiddleware('test-secret', exists);
    const token = jwt.sign(
      { id: 'user-1', tenantId: 'mercadozetta', tokenVersion: 0 },
      'test-secret',
    );
    const next = vi.fn();

    await authMiddleware(
      {
        headers: { authorization: `Bearer ${token}` },
        tenant: { id: 'mercadozetta' },
      },
      {},
      next,
    );

    expect(exists).toHaveBeenCalledWith({
      _id: 'user-1',
      tenantId: 'mercadozetta',
      $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }],
    });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_AUTH_TOKEN' }),
    );
  });

  it('rejects tokens that cannot be verified', () => {
    const authMiddleware = loadAuthMiddleware();
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
      tenant: { id: 'mercadozetta' },
    };
    const next = vi.fn();

    authMiddleware(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_AUTH_TOKEN',
      }),
    );
  });
});
