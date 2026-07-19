import bcrypt from 'bcryptjs';
import AppError from '@/errors/AppError';
import type { UserRepository } from '@/repositories/userRepository';
import type { SessionService } from '@/services/sessionService';
import { defaultTenantId } from '@/tenants';
import {
  type LoginCredentials,
  type LoginRequestBody,
  validateLoginPayload,
} from '@/validators/authValidator';

export type AuthSessionService = Pick<
  SessionService,
  'createSession' | 'getSession' | 'revokeAllSessions'
>;

export function createAuthService(
  userRepository: UserRepository,
  sessionService: AuthSessionService,
) {
  async function authenticate(
    body: LoginRequestBody | LoginCredentials,
    tenantId = defaultTenantId,
    userAgent?: string,
  ) {
    const { email, password } = validateLoginPayload(body);
    const user = await userRepository.findForAuthentication(tenantId, email);

    /* v8 ignore else */
    if (!user || user.deactivatedAt)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    /* v8 ignore else */
    if (!(await bcrypt.compare(password, user.passwordHash)))
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    const publicUser: Partial<typeof user> = { ...user };
    delete publicUser.passwordHash;
    delete publicUser.tokenVersion;
    const sessionCredentials = await sessionService.createSession(
      user._id,
      tenantId,
      user.tokenVersion,
      userAgent,
      new Date(),
    );

    return { user: publicUser, ...sessionCredentials };
  }

  async function logout(userId: string, tenantId: string) {
    const updated = await userRepository.incrementTokenVersion(
      tenantId,
      userId,
    );

    /* v8 ignore else */
    if (!updated)
      throw new AppError(
        401,
        'INVALID_AUTH_TOKEN',
        'Invalid authorization token',
      );

    await sessionService.revokeAllSessions(userId, tenantId, new Date());
  }

  async function getSessionState(
    sessionId: string,
    userId: string,
    tenantId: string,
  ) {
    const [session, user] = await Promise.all([
      sessionService.getSession(sessionId, userId, tenantId, new Date()),
      userRepository.findPublicById(tenantId, userId),
    ]);

    /* v8 ignore next */
    if (!user)
      throw new AppError(
        401,
        'INVALID_AUTH_TOKEN',
        'Invalid authorization token',
      );

    return { user, session };
  }

  return { authenticate, logout, getSessionState };
}

export type AuthService = ReturnType<typeof createAuthService>;
