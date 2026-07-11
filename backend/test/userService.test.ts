import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../src/model/user', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

import User from '../src/model/user';
import { createUser, getPublicSellerProfile } from '../src/services/userService';

const mockedUser = User as typeof User & {
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

describe('user service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.findOne.mockReset();
    mockedUser.create.mockReset();
  });

  it('creates users and exposes seller profiles', async () => {
    const userId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const sellerId = new Types.ObjectId('607f1f77bcf86cd799439012');

    mockedUser.findOne.mockResolvedValue(null);
    mockedUser.create.mockResolvedValue({
      toObject: () => ({ _id: userId, email: 'buyer@example.com', username: 'Buyer', telephone: '123', tenantId: 'mercadozetta' }),
    });

    const createdUser = await createUser({
      email: 'Buyer@Example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '123456789',
    }, 'mercadozetta');

    expect(createdUser).toEqual({
      _id: userId,
      email: 'buyer@example.com',
      username: 'Buyer',
      telephone: '123',
      tenantId: 'mercadozetta',
    });

    mockedUser.findOne.mockResolvedValue({
      _id: sellerId,
      username: 'Seller',
      telephone: '123',
      email: 'seller@example.com',
    });

    const sellerProfile = await getPublicSellerProfile(String(sellerId), 'mercadozetta');

    expect(sellerProfile).toEqual({
      _id: sellerId,
      username: 'Seller',
      telephone: '123',
      email: 'seller@example.com',
      storeName: 'Seller store',
    });
  });

  it('handles persistence error shapes and the anonymous seller-name fallback', async () => {
    const validUser = {
      email: 'buyer@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '123',
    };

    mockedUser.findOne.mockResolvedValueOnce(null);
    mockedUser.create.mockResolvedValueOnce({
      toObject: () => ({ ...validUser, _id: 'user-1' }),
    });
    await expect(createUser(validUser)).resolves.not.toHaveProperty('password');

    mockedUser.findOne.mockResolvedValueOnce({ _id: 'existing' });
    await expect(createUser(validUser)).rejects.toMatchObject({ code: 'USER_EXISTS' });

    mockedUser.findOne.mockResolvedValueOnce(null);
    mockedUser.create.mockRejectedValueOnce('database unavailable');
    await expect(createUser(validUser)).rejects.toBe('database unavailable');

    mockedUser.findOne.mockResolvedValueOnce(null);
    mockedUser.create.mockRejectedValueOnce({ code: 42 });
    await expect(createUser(validUser)).rejects.toEqual({ code: 42 });

    mockedUser.findOne.mockResolvedValueOnce({
      _id: 'seller-1',
      username: '',
      telephone: '123',
      email: 'seller@example.com',
    });
    await expect(getPublicSellerProfile('seller-1')).resolves.toMatchObject({ storeName: 'Seller store' });

    mockedUser.findOne.mockResolvedValueOnce(null);
    await expect(getPublicSellerProfile('missing')).rejects.toMatchObject({ code: 'SELLER_NOT_FOUND' });
  });
});
