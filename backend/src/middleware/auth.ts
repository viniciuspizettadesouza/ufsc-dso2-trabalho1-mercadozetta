import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import AppError from '@/errors/AppError';
import { getAuthCookieConfig, getJwtSigningKeyRing } from '@/config/security';
import Session from '@/model/session';
import User from '@/model/user';
import { accessTokenContract } from '@/services/sessionService';

type AuthTokenPayload = {
  sub?: string;
  tenantId?: string;
  sid?: string;
  tokenVersion?: number;
  typ?: string;
};

async function authenticateCookie(req: Request, token: string) {
  const decodedToken = jwt.decode(token, { complete: true });
  const kid = decodedToken?.header.kid;
  const secret =
    typeof kid === 'string' ? getJwtSigningKeyRing().keys[kid] : undefined;
  if (!secret) {
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );
  }

  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: accessTokenContract.issuer,
    audience: accessTokenContract.audience,
  }) as AuthTokenPayload;

  if (
    decoded.typ !== 'access' ||
    typeof decoded.sub !== 'string' ||
    !decoded.sub.trim() ||
    typeof decoded.sid !== 'string' ||
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
    Session.exists({
      _id: decoded.sid,
      userId: decoded.sub,
      tenantId: decoded.tenantId,
      tokenVersion: decoded.tokenVersion,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    }),
    User.exists({
      _id: decoded.sub,
      tenantId: decoded.tenantId,
      tokenVersion: decoded.tokenVersion,
    }),
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

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const accessCookie = req.cookies?.[getAuthCookieConfig().access.name];

  if (typeof accessCookie !== 'string')
    return next(
      new AppError(
        401,
        'AUTH_TOKEN_REQUIRED',
        'Authorization token is required',
      ),
    );

  try {
    await authenticateCookie(req, accessCookie);
    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(
      new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'),
    );
  }
}

export default authMiddleware;
