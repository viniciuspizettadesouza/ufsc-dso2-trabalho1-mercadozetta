const rateLimit = require('express-rate-limit');
const { getRateLimitConfig } = require('../config/security');

function createRateLimiter(scope) {
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

module.exports = {
    authRateLimiter: createRateLimiter('auth'),
    registerRateLimiter: createRateLimiter('register'),
};
