const { resolveTenant } = require('../tenants');

function tenantMiddleware(req, res, next) {
    const tenant = resolveTenant(req.headers['x-tenant-id']);

    if (!tenant)
        return res.status(400).send({ error: 'Invalid tenant' });

    req.tenant = tenant;
    return next();
}

module.exports = tenantMiddleware;
