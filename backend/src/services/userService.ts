import AppError from '../errors/AppError';
import User from '../model/user';
import { defaultTenantId } from '../tenants';
import { type CreateUserData, type CreateUserRequestBody, validateCreateUserPayload } from '../validators/userValidator';

type MongoDuplicateKeyError = {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, string>;
};

function stripPassword<T extends { password?: string }>(userObject: T) {
  const publicUser = { ...userObject };
  delete publicUser.password;
  return publicUser;
}

function isDuplicateKeyError(err: object): err is MongoDuplicateKeyError {
  return 'code' in err && err.code === 11000;
}

function getDuplicateKeyField(err: object) {
  if (!isDuplicateKeyError(err))
    return null;

  const fields = Object.keys(err.keyPattern || err.keyValue || {});

  return fields[0] || null;
}

export async function createUser(body: CreateUserRequestBody | CreateUserData, tenantId = defaultTenantId) {
  const userData = validateCreateUserPayload(body);

  try {
    if (await User.findOne({ tenantId, email: userData.email }))
      throw new AppError(400, 'USER_EXISTS', 'User already exists');

    const newUser = await User.create({
      ...userData,
      tenantId,
    });
    return stripPassword(newUser.toObject());
  } catch (err) {
    const duplicateField = err !== null && typeof err === 'object'
      ? getDuplicateKeyField(err)
      : null;

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
