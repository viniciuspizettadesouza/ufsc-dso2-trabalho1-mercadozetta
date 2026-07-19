import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getAllowedCorsOrigins, getAuthCookieConfig } from '@/config/security';
import AppError from '@/errors/AppError';
import {
  getRefreshTokenSessionId,
  verifyCsrfToken,
} from '@/services/sessionSecurityService';

export function valuesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function getRequestOrigin(req: Request) {
  const origin = req.get('origin');
  if (origin) return origin;

  const referer = req.get('referer');
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function hasAllowedOrigin(req: Request) {
  const origin = getRequestOrigin(req);
  return Boolean(origin && getAllowedCorsOrigins().includes(origin));
}

export function requireAllowedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!hasAllowedOrigin(req)) {
    return next(
      new AppError(403, 'INVALID_ORIGIN', 'Request origin is invalid'),
    );
  }

  return next();
}

export function validatePresentOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.get('origin') && !req.get('referer')) return next();
  return requireAllowedOrigin(req, res, next);
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (!hasAllowedOrigin(req)) {
    return next(
      new AppError(403, 'INVALID_ORIGIN', 'Request origin is invalid'),
    );
  }

  const cookies = getAuthCookieConfig();
  const cookieToken = req.cookies?.[cookies.csrf.name];
  const headerToken = req.get('x-csrf-token');
  const refreshToken = req.cookies?.[cookies.refresh.name];
  const sessionId =
    req.sessionId ||
    (typeof refreshToken === 'string'
      ? getRefreshTokenSessionId(refreshToken)
      : null);

  if (
    typeof cookieToken !== 'string' ||
    !headerToken ||
    !sessionId ||
    !valuesMatch(cookieToken, headerToken) ||
    !verifyCsrfToken(headerToken, sessionId)
  ) {
    return next(
      new AppError(403, 'INVALID_CSRF_TOKEN', 'CSRF token is invalid'),
    );
  }

  return next();
}
