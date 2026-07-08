const DEFAULT_DEV_JWT_SECRET = 'mercadozetta-dev-secret';
const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173'];

function getNodeEnv() {
    return process.env.NODE_ENV || 'development';
}

function isLocalEnv() {
    return ['development', 'test'].includes(getNodeEnv());
}

function parseList(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function getJwtSecret() {
    if (process.env.JWT_SECRET)
        return process.env.JWT_SECRET;

    if (isLocalEnv())
        return DEFAULT_DEV_JWT_SECRET;

    throw new Error('JWT_SECRET environment variable is required outside development and test');
}

function getAllowedCorsOrigins() {
    const configuredOrigins = parseList(process.env.CORS_ORIGIN);

    if (configuredOrigins.length)
        return configuredOrigins;

    return isLocalEnv() ? DEFAULT_DEV_CORS_ORIGINS : [];
}

function getCorsOptions() {
    const allowedOrigins = getAllowedCorsOrigins();

    return {
        origin(origin, callback) {
            if (!origin)
                return callback(null, true);

            return callback(null, allowedOrigins.includes(origin));
        },
    };
}

function readPositiveInteger(name, fallback) {
    const value = Number.parseInt(process.env[name], 10);

    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getRateLimitConfig(scope) {
    const prefix = scope === 'register' ? 'RATE_LIMIT_REGISTER' : 'RATE_LIMIT_AUTH';
    const fallbackLimit = scope === 'register' ? 10 : 5;

    return {
        windowMs: readPositiveInteger(`${prefix}_WINDOW_MS`, 15 * 60 * 1000),
        limit: readPositiveInteger(`${prefix}_MAX`, fallbackLimit),
        message: scope === 'register'
            ? 'Too many account creation attempts, please try again later'
            : 'Too many login attempts, please try again later',
    };
}

module.exports = {
    getAllowedCorsOrigins,
    getCorsOptions,
    getJwtSecret,
    getRateLimitConfig,
};
