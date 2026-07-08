const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');
const { getJwtSecret } = require('../config/security');

module.exports = function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader)
        return next(new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authorization token is required'));

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token)
        return next(new AppError(401, 'INVALID_AUTH_FORMAT', 'Invalid authorization format'));

    const jwtSecret = getJwtSecret();

    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded.tenantId && req.tenant && decoded.tenantId !== req.tenant.id)
            return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));

        req.userId = decoded.id;
        return next();
    } catch (err) {
        return next(new AppError(401, 'INVALID_AUTH_TOKEN', 'Invalid authorization token'));
    }
};
