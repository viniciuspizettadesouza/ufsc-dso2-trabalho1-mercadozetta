import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import AppError from '@/errors/AppError';
import { isUuid } from '@/ids';
import { getAuthCookieConfig, getJwtSigningKeyRing } from '@/config/security';
import type { SessionRepository } from '@/repositories/sessionRepository';
import type { UserRepository } from '@/repositories/userRepository';
import { accessTokenContract } from '@/services/sessionService';

type AuthTokenPayload = {
  sub?: string;
  tenantId?: string;
  sid?: string;
  tokenVersion?: number;
  typ?: string;
};

type AuthMiddlewareDependencies = {
  signingKeyRing(): { keys: Record<string, string> };
  authCookieName(): string;
  tokenContract: typeof accessTokenContract;
};

const defaultDependencies: AuthMiddlewareDependencies = {
  signingKeyRing: getJwtSigningKeyRing,
  authCookieName: () => getAuthCookieConfig().access.name,
  tokenContract: accessTokenContract,
};

async function authenticateCookie(
  userRepository: UserRepository,
  sessions: SessionRepository,
  dependencies: AuthMiddlewareDependencies,
  req: Request,
  token: string,
) {
  const decodedToken = jwt.decode(token, { complete: true });
  const kid = decodedToken?.header.kid;
  const secret =
    typeof kid === 'string'
      ? dependencies.signingKeyRing().keys[kid]
      : undefined;
  if (!secret) {
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );
  }

  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: dependencies.tokenContract.issuer,
    audience: dependencies.tokenContract.audience,
  }) as AuthTokenPayload;

  if (
    decoded.typ !== 'access' ||
    typeof decoded.sub !== 'string' ||
    !isUuid(decoded.sub) ||
    typeof decoded.sid !== 'string' ||
    !isUuid(decoded.sid) ||
    typeof decoded.tenantId !== 'string' ||
    typeof decoded.tokenVersion !== 'number' ||
    (req.tenant && decoded.tenantId !== req.tenant.id)
  ) {
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );
  }

  const now = new Date();
  const [activeSession, activeUser] = await Promise.all([
    sessions.isActive(
      decoded.tenantId,
      decoded.sub,
      decoded.sid,
      decoded.tokenVersion,
      now,
    ),
    userRepository.hasTokenVersion(
      decoded.tenantId,
      decoded.sub,
      decoded.tokenVersion,
    ),
  ]);

  if (!activeSession || !activeUser) {
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );
  }

  req.userId = decoded.sub;
  req.sessionId = decoded.sid;
}

export function createAuthMiddleware(
  userRepository: UserRepository,
  sessions: SessionRepository,
  dependencies: AuthMiddlewareDependencies = defaultDependencies,
) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const accessCookie = req.cookies?.[dependencies.authCookieName()];

    if (typeof accessCookie !== 'string')
      return next(
        new AppError(
          401,
          'AUTH_TOKEN_REQUIRED',
          'Authorization token is required',
        ),
      );

    try {
      await authenticateCookie(
        userRepository,
        sessions,
        dependencies,
        req,
        accessCookie,
      );
      return next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      return next(
        new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'),
      );
    }
  };
}
