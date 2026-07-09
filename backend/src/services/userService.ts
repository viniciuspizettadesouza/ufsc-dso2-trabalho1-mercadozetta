import AppError from '../errors/AppError';
import User from '../model/user';
import { defaultTenantId } from '../tenants';
import { validateCreateUserPayload } from '../validators/userValidator';

type DuplicateKeyError = {
  code?: unknown;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
};

function stripPassword<T extends Record<string, unknown>>(userObject: T) {
  const publicUser = { ...userObject };
  delete publicUser.password;
  return publicUser;
}

function getDuplicateField(err: unknown) {
  const duplicateError = err as DuplicateKeyError;

  if (duplicateError.code !== 11000)
    return null;

  const fields = Object.keys(duplicateError.keyPattern || duplicateError.keyValue || {});

  return fields[0] || null;
}

export async function createUser(body: Record<string, unknown>, tenantId = defaultTenantId) {
  const payload = validateCreateUserPayload(body);

  try {
    if (await User.findOne({ tenantId, email: payload.email }))
      throw new AppError(400, 'USER_EXISTS', 'User already exists');

    const newUser = await User.create({
      ...payload,
      tenantId,
    });
    return stripPassword(newUser.toObject());
  } catch (err) {
    const duplicateField = getDuplicateField(err);

    if (duplicateField === 'email' || duplicateField === 'tenantId')
      throw new AppError(400, 'USER_EXISTS', 'User already exists');

    throw err;
  }
}

export async function getPublicSellerProfile(userId: string, tenantId = defaultTenantId) {
  const seller = await User.findOne({ _id: userId, tenantId });

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

const UserService = {
  createUser,
  getPublicSellerProfile,
};

export default UserService;
