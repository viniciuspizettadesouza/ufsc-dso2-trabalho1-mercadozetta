import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtAccessTokenTtl, getJwtSecret } from '../config/security';
import AppError from '../errors/AppError';
import User from '../model/user';
import { defaultTenantId } from '../tenants';
import {
  type LoginCredentials,
  type LoginRequestBody,
  validateLoginPayload,
} from '../validators/authValidator';

function stripSensitiveFields<
  T extends { password?: string; tokenVersion?: number },
>(userObject: T) {
  const publicUser = { ...userObject };
  delete publicUser.password;
  delete publicUser.tokenVersion;
  return publicUser;
}

export async function authenticate(
  body: LoginRequestBody | LoginCredentials,
  tenantId = defaultTenantId,
) {
  const { email, password } = validateLoginPayload(body);
  const user = await User.findOne({ tenantId, email }).select(
    '+password +tokenVersion email username telephone tenantId',
  );

  if (!user)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  if (!(await bcrypt.compare(password, (user.password ?? '') as string)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  const token = jwt.sign(
    { id: user._id, tenantId, tokenVersion: user.tokenVersion ?? 0 },
    getJwtSecret(),
    { expiresIn: getJwtAccessTokenTtl() as jwt.SignOptions['expiresIn'] },
  );

  return {
    user: stripSensitiveFields(user.toObject()),
    token,
  };
}

export async function logout(userId: string, tenantId: string) {
  const result = await User.updateOne(
    { _id: userId, tenantId },
    { $inc: { tokenVersion: 1 } },
  );

  if (result.matchedCount !== 1)
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );
}

const AuthService = {
  authenticate,
  logout,
};

export default AuthService;
