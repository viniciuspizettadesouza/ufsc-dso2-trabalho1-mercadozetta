import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { getRateLimitConfig, type RateLimitScope } from '@/config/security';

const rateLimitCodes: Record<RateLimitScope, string> = {
  register: 'REGISTER_RATE_LIMITED',
  auth: 'AUTH_RATE_LIMITED',
  emailVerificationRequest: 'EMAIL_VERIFICATION_REQUEST_RATE_LIMITED',
  emailVerificationConfirmation: 'EMAIL_VERIFICATION_CONFIRMATION_RATE_LIMITED',
  passwordResetRequest: 'PASSWORD_RESET_REQUEST_RATE_LIMITED',
  passwordResetConfirmation: 'PASSWORD_RESET_CONFIRMATION_RATE_LIMITED',
  passwordChange: 'PASSWORD_CHANGE_RATE_LIMITED',
  emailChangeRequest: 'EMAIL_CHANGE_REQUEST_RATE_LIMITED',
  emailChangeConfirmation: 'EMAIL_CHANGE_CONFIRMATION_RATE_LIMITED',
  accountDeactivation: 'ACCOUNT_DEACTIVATION_RATE_LIMITED',
};

export function authenticatedAccountRateLimitKey(req: Request) {
  return [
    req.tenant?.id || 'unknown-tenant',
    req.userId || 'unknown-user',
    ipKeyGenerator(req.ip || ''),
  ].join(':');
}

function createRateLimiter(scope: RateLimitScope, authenticated = false) {
  const config = getRateLimitConfig(scope);

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: config.message,
      code: rateLimitCodes[scope],
    },
    ...(authenticated
      ? {
          keyGenerator: authenticatedAccountRateLimitKey,
        }
      : {}),
  });
}

export const authRateLimiter = createRateLimiter('auth');
export const registerRateLimiter = createRateLimiter('register');
export const emailVerificationRequestRateLimiter = createRateLimiter(
  'emailVerificationRequest',
);
export const emailVerificationConfirmationRateLimiter = createRateLimiter(
  'emailVerificationConfirmation',
);
export const passwordResetRequestRateLimiter = createRateLimiter(
  'passwordResetRequest',
);
export const passwordResetConfirmationRateLimiter = createRateLimiter(
  'passwordResetConfirmation',
);
export const passwordChangeRateLimiter = createRateLimiter(
  'passwordChange',
  true,
);
export const emailChangeRequestRateLimiter = createRateLimiter(
  'emailChangeRequest',
  true,
);
export const emailChangeConfirmationRateLimiter = createRateLimiter(
  'emailChangeConfirmation',
);
export const accountDeactivationRateLimiter = createRateLimiter(
  'accountDeactivation',
  true,
);
