import rateLimit from 'express-rate-limit';
import { getRateLimitConfig } from '../config/security';

function createRateLimiter(scope: 'auth' | 'register') {
  const config = getRateLimitConfig(scope);

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: config.message,
      code: scope === 'register' ? 'REGISTER_RATE_LIMITED' : 'AUTH_RATE_LIMITED',
    },
  });
}

export const authRateLimiter = createRateLimiter('auth');
export const registerRateLimiter = createRateLimiter('register');
