import bcrypt from 'bcryptjs';
import AppError from '@/errors/AppError';
import User from '@/model/user';
import {
  createSession,
  getSession,
  revokeAllSessions,
} from '@/services/sessionService';
import { defaultTenantId } from '@/tenants';
import {
  type LoginCredentials,
  type LoginRequestBody,
  validateLoginPayload,
} from '@/validators/authValidator';

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
  userAgent?: string,
) {
  const { email, password } = validateLoginPayload(body);
  const user = await User.findOne({ tenantId, email }).select(
    '+password +tokenVersion email username telephone tenantId',
  );

  /* v8 ignore else */
  if (!user)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  /* v8 ignore else */
  if (!(await bcrypt.compare(password, user.password as string)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  const sessionCredentials = await createSession(
    String(user._id),
    tenantId,
    user.tokenVersion as number,
    userAgent,
    new Date(),
  );

  return {
    user: stripSensitiveFields(user.toObject()),
    ...sessionCredentials,
  };
}

export async function logout(userId: string, tenantId: string) {
  const result = await User.updateOne(
    { _id: userId, tenantId },
    { $inc: { tokenVersion: 1 } },
  );

  /* v8 ignore else */
  if (result.matchedCount !== 1)
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );

  await revokeAllSessions(userId, tenantId, new Date());
}

export async function getSessionState(
  sessionId: string,
  userId: string,
  tenantId: string,
) {
  const [session, user] = await Promise.all([
    getSession(sessionId, userId, tenantId, new Date()),
    User.findOne({ _id: userId, tenantId }).select(
      'email username telephone tenantId',
    ),
  ]);

  /* v8 ignore next */
  if (!user)
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );

  return {
    user: stripSensitiveFields(user.toObject()),
    session,
  };
}

const AuthService = {
  authenticate,
  getSessionState,
  logout,
};

export default AuthService;
