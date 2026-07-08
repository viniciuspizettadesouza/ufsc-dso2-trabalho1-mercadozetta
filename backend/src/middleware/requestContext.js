const crypto = require('crypto');

function requestContext(req, res, next) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (process.env.NODE_ENV !== 'test') {
        const startedAt = Date.now();
        res.on('finish', () => {
            console.log(JSON.stringify({
                requestId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Date.now() - startedAt,
            }));
        });
    }

    return next();
}

module.exports = requestContext;
