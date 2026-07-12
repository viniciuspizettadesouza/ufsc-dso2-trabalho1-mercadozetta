import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const servicePath = require.resolve('@/services/authService');
const securityPath = require.resolve('@/config/security');
const userModelPath = require.resolve('@/model/user');

function loadAuthService(
  userModel: NodeModule['exports'],
  secret = 'unit-test-secret',
) {
  clearModules(servicePath, securityPath, userModelPath);
  mockModule(userModelPath, userModel);
  mockModule(securityPath, {
    getJwtSecret: () => secret,
    getJwtAccessTokenTtl: () => '15m',
  });
  return require('@/services/authService');
}

afterEach(() => {
  clearModules(servicePath, securityPath, userModelPath);
  vi.restoreAllMocks();
});

describe('authService', () => {
  it('normalizes email, verifies password, signs tenant-aware tokens, and strips passwords', async () => {
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
    const signSpy = vi.spyOn(jwt, 'sign');
    const { authenticate } = loadAuthService({ findOne });

    const result = await authenticate(
      {
        email: ' Seller@Example.com ',
        password: 'secret123',
      },
      'campus-market',
    );

    expect(findOne).toHaveBeenCalledWith({
      tenantId: 'campus-market',
      email: 'seller@example.com',
    });
    expect(select).toHaveBeenCalledWith(
      '+password +tokenVersion email username telephone tenantId',
    );
    expect(signSpy).toHaveBeenCalledWith(
      { id: 'user-1', tenantId: 'campus-market', tokenVersion: 2 },
      'unit-test-secret',
      { expiresIn: '15m' },
    );
    expect(result.user.password).toBeUndefined();
    expect(result.user.tokenVersion).toBeUndefined();
    expect(result.token).toEqual(expect.any(String));
  });

  it('increments the token version to revoke active sessions', async () => {
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
    const { logout } = loadAuthService({ updateOne });

    await logout('user-1', 'mercadozetta');

    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'user-1', tenantId: 'mercadozetta' },
      { $inc: { tokenVersion: 1 } },
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
});
