import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createUserController } from '@/controller/userController';
import type { UserService } from '@/services/userService';

const user = {
  _id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  email: 'seller@example.com',
  username: 'Seller',
  telephone: '999',
  password: 'hash',
  tokenVersion: 0,
  createdAt: new Date('2026-07-15T12:00:00.000Z'),
  updatedAt: new Date('2026-07-15T12:00:00.000Z'),
};

function responseDouble() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.send = vi.fn().mockReturnValue(response);
  return response;
}

describe('userController', () => {
  it('returns the created user without a response wrapper', async () => {
    const createUser = vi.fn().mockResolvedValue(user);
    const controller = createUserController({
      createUser,
    } as unknown as UserService);
    const body = {
      email: user.email,
      password: 'password123',
      username: user.username,
      telephone: user.telephone,
    };
    const response = responseDouble();

    await controller.add(
      {
        validated: { body },
        tenant: { id: user.tenantId },
      } as unknown as Request & never,
      response,
    );

    expect(createUser).toHaveBeenCalledWith(body, user.tenantId);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.send).toHaveBeenCalledWith(user);
    expect(response.send).not.toHaveBeenCalledWith({ newUser: user });
  });

  it('delegates seller lookup and uses empty tenant fallbacks', async () => {
    const seller = {
      _id: user._id,
      email: user.email,
      username: user.username,
      telephone: user.telephone,
      storeName: 'Seller store',
    };
    const createUser = vi.fn().mockResolvedValue(user);
    const getPublicSellerProfile = vi.fn().mockResolvedValue(seller);
    const controller = createUserController({
      createUser,
      getPublicSellerProfile,
    } as unknown as UserService);
    const response = responseDouble();

    await controller.add(
      { validated: { body: {} } } as unknown as Request & never,
      response,
    );
    await controller.sellerProfile(
      {
        validated: { params: { userId: user._id } },
      } as unknown as Request & never,
      response,
    );

    expect(createUser).toHaveBeenCalledWith({}, '');
    expect(getPublicSellerProfile).toHaveBeenCalledWith(user._id, '');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(seller);
  });
});
