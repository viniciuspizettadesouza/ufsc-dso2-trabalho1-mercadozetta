import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/model/user', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/config/security', () => ({
  getJwtSecret: vi.fn(() => 'test-secret'),
  getJwtAccessTokenTtl: vi.fn(() => '15m'),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'signed-token'),
  },
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '@/model/user';
import { authenticate } from '@/services/authService';

const mockedUser = User as typeof User & {
  findOne: ReturnType<typeof vi.fn>;
};

const mockedBcrypt = bcrypt as typeof bcrypt & {
  compare: ReturnType<typeof vi.fn>;
};

const mockedJwt = jwt as typeof jwt & {
  sign: ReturnType<typeof vi.fn>;
};

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.findOne.mockReset();
    mockedBcrypt.compare.mockReset();
    mockedJwt.sign.mockReset();
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
    mockedJwt.sign.mockReturnValue('signed-token');

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
    expect(mockedJwt.sign).toHaveBeenCalledWith(
      { id: 'user-1', tenantId: 'mercadozetta', tokenVersion: 0 },
      'test-secret',
      { expiresIn: '15m' },
    );
    expect(result.user).toEqual({ _id: 'user-1', email: 'seller@example.com' });
    expect(result.token).toBe('signed-token');
  });
});
