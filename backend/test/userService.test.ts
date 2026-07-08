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

const mockedUser = User as unknown as {
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
});
