import { describe, expect, it, vi } from 'vitest';
import {
  DuplicateUserEmailError,
  type UserRepository,
} from '@/repositories/userRepository';
import { createUserService } from '@/services/userService';

function repository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    emailExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    findPublicById: vi.fn().mockResolvedValue(null),
    findForAuthentication: vi.fn().mockResolvedValue(null),
    findForAccountSecurity: vi.fn().mockResolvedValue(null),
    findForAccountSecurityForUpdate: vi.fn().mockResolvedValue(null),
    findAccountSecurityById: vi.fn().mockResolvedValue(null),
    findAccountSecurityByIdForUpdate: vi.fn().mockResolvedValue(null),
    updateProfile: vi.fn().mockResolvedValue(null),
    replaceAccountPassword: vi.fn().mockResolvedValue(false),
    promoteAccountEmail: vi.fn().mockResolvedValue(false),
    deactivateAccount: vi.fn().mockResolvedValue(false),
    markEmailVerified: vi.fn().mockResolvedValue(false),
    replacePasswordAndIncrementTokenVersion: vi.fn().mockResolvedValue(false),
    findTokenVersion: vi.fn().mockResolvedValue(null),
    hasTokenVersion: vi.fn().mockResolvedValue(false),
    incrementTokenVersion: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('userService', () => {
  it('creates normalized users for a tenant without persistence details', async () => {
    const userRepository = repository({
      create: vi.fn().mockResolvedValue({
        _id: 'user-1',
        tenantId: 'campus-market',
        email: 'buyer@example.com',
        username: 'Buyer',
        telephone: '999',
      }),
    });
    const { createUser } = createUserService(userRepository);

    const user = await createUser(
      {
        email: ' Buyer@Example.com ',
        password: 'secret123',
        username: ' Buyer ',
        telephone: ' 999 ',
      },
      'campus-market',
    );

    expect(userRepository.emailExists).toHaveBeenCalledWith(
      'campus-market',
      'buyer@example.com',
    );
    expect(userRepository.create).toHaveBeenCalledWith({
      tenantId: 'campus-market',
      email: 'buyer@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });
    expect(user).toMatchObject({
      _id: 'user-1',
      email: 'buyer@example.com',
      tenantId: 'campus-market',
    });
    expect(user).not.toHaveProperty('password');
  });

  it('maps lookup hits and repository uniqueness races to USER_EXISTS', async () => {
    let { createUser } = createUserService(
      repository({ emailExists: vi.fn().mockResolvedValue(true) }),
    );

    await expect(
      createUser({
        email: 'buyer@example.com',
        password: 'secret123',
        username: 'Buyer',
        telephone: '999',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'USER_EXISTS' });

    ({ createUser } = createUserService(
      repository({
        create: vi.fn().mockRejectedValue(new DuplicateUserEmailError()),
      }),
    ));

    await expect(
      createUser({
        email: 'buyer@example.com',
        password: 'secret123',
        username: 'Buyer',
        telephone: '999',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'USER_EXISTS' });
  });

  it('rethrows non-duplicate repository errors', async () => {
    const error = new Error('database down');
    const { createUser } = createUserService(
      repository({ create: vi.fn().mockRejectedValue(error) }),
    );

    await expect(
      createUser({
        email: 'buyer@example.com',
        password: 'secret123',
        username: 'Buyer',
        telephone: '999',
      }),
    ).rejects.toBe(error);
  });

  it('returns public seller profiles and reports missing sellers', async () => {
    const findPublicById = vi
      .fn()
      .mockResolvedValueOnce({
        _id: 'user-1',
        tenantId: 'mercadozetta',
        username: 'Seller',
        telephone: '123',
        email: 'seller@example.com',
      })
      .mockResolvedValueOnce(null);
    const { getPublicSellerProfile } = createUserService(
      repository({ findPublicById }),
    );

    await expect(
      getPublicSellerProfile('user-1', 'mercadozetta'),
    ).resolves.toEqual({
      _id: 'user-1',
      username: 'Seller',
      telephone: '123',
      email: 'seller@example.com',
      storeName: 'Seller store',
    });
    expect(findPublicById).toHaveBeenCalledWith('mercadozetta', 'user-1');

    await expect(
      getPublicSellerProfile('missing', 'mercadozetta'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'SELLER_NOT_FOUND' });
  });
});
