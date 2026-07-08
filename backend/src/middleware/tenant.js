const AppError = require('../errors/AppError');
const { resolveTenant } = require('../tenants');

function tenantMiddleware(req, res, next) {
    const tenant = resolveTenant(req.headers['x-tenant-id']);

    if (!tenant)
        return next(new AppError(400, 'INVALID_TENANT', 'Invalid tenant'));

    req.tenant = tenant;
    return next();
}

module.exports = tenantMiddleware;
