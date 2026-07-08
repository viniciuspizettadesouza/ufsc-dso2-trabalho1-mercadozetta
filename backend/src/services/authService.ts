import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';
import AppError from '../errors/AppError';
import User from '../model/user';
import { defaultTenantId } from '../tenants';
import { validateLoginPayload } from '../validators/authValidator';

export async function authenticate(body: Record<string, unknown>, tenantId = defaultTenantId) {
  const { email, password } = validateLoginPayload(body);
  const user = await User.findOne({ tenantId, email }).select('+password email username telephone tenantId');

  if (!user)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  if (!await bcrypt.compare(password, (user.password ?? '') as string))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  const userObject = user.toObject();
  delete (userObject as any).password;

  const token = jwt.sign(
    { id: user._id, tenantId },
    getJwtSecret(),
    { expiresIn: '1d' }
  );

  return {
    user: userObject,
    token,
  };
}

const AuthService = {
  authenticate,
};

export default AuthService;
