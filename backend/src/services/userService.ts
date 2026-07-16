import AppError from '@/errors/AppError';
import {
  DuplicateUserEmailError,
  type UserRepository,
} from '@/repositories/userRepository';
import { defaultTenantId } from '@/tenants';
import {
  type CreateUserData,
  type CreateUserRequestBody,
  validateCreateUserPayload,
} from '@/validators/userValidator';

export function createUserService(repository: UserRepository) {
  async function createUser(
    body: CreateUserRequestBody | CreateUserData,
    tenantId = defaultTenantId,
  ) {
    const userData = validateCreateUserPayload(body);

    try {
      if (await repository.emailExists(tenantId, userData.email))
        throw new AppError(400, 'USER_EXISTS', 'User already exists');

      return await repository.create({ ...userData, tenantId });
    } catch (error) {
      if (error instanceof DuplicateUserEmailError)
        throw new AppError(400, 'USER_EXISTS', 'User already exists');
      throw error;
    }
  }

  async function getPublicSellerProfile(
    userId: string,
    tenantId = defaultTenantId,
  ) {
    const seller = await repository.findPublicById(tenantId, userId);

    if (!seller)
      throw new AppError(404, 'SELLER_NOT_FOUND', 'Seller not found');

    return {
      _id: seller._id,
      username: seller.username,
      telephone: seller.telephone,
      email: seller.email,
      storeName: seller.username ? `${seller.username} store` : 'Seller store',
    };
  }

  return { createUser, getPublicSellerProfile };
}

export type UserService = ReturnType<typeof createUserService>;
