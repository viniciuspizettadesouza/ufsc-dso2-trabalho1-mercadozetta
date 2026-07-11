import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import { getJwtSecret } from '../config/security';
import User from '../model/user';

type AuthTokenPayload = {
  id?: string;
  tenantId?: string;
  tokenVersion?: number;
};

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return next(new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authorization token is required'));

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token)
    return next(new AppError(401, 'INVALID_AUTH_FORMAT', 'Invalid authorization format'));

  const jwtSecret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthTokenPayload;
    if (typeof decoded.id !== 'string' || !decoded.id.trim())
      return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));

    if (typeof decoded.tenantId !== 'string' || typeof decoded.tokenVersion !== 'number')
      return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));

    if (decoded.tenantId && req.tenant && decoded.tenantId !== req.tenant.id)
      return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));

    const sessionQuery: Record<string, unknown> = {
      _id: decoded.id,
      tenantId: decoded.tenantId,
      tokenVersion: decoded.tokenVersion,
    };

    if (decoded.tokenVersion === 0) {
      delete sessionQuery.tokenVersion;
      sessionQuery.$or = [
        { tokenVersion: 0 },
        { tokenVersion: { $exists: false } },
      ];
    }

    const activeSession = await User.exists(sessionQuery);

    if (!activeSession)
      return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));

    req.userId = decoded.id;
    return next();
  } catch (err) {
    return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));
  }
}

export default authMiddleware;
