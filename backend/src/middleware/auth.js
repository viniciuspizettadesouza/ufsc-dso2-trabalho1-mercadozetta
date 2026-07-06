const jwt = require('jsonwebtoken');

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
            process.env.JWT_SECRET || 'mercadozetta-dev-secret'
        );

        req.userId = decoded.id;
        return next();
    } catch (err) {
        return res.status(401).send({ error: 'Invalid authorization token' });
    }
};
