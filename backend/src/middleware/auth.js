const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/security');

module.exports = function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader)
        return res.status(401).send({ error: 'Authorization token is required' });

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token)
        return res.status(401).send({ error: 'Invalid authorization format' });

    try {
        const decoded = jwt.verify(
            token,
            getJwtSecret()
        );

        if (decoded.tenantId && req.tenant && decoded.tenantId !== req.tenant.id)
            return res.status(401).send({ error: 'Invalid authorization token' });

        req.userId = decoded.id;
        return next();
    } catch (err) {
        return res.status(401).send({ error: 'Invalid authorization token' });
    }
};
