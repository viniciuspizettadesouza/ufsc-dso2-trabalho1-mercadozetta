const AppError = require('../errors/AppError');

function errorHandler(err, req, res, next) {
    if (res.headersSent)
        return next(err);

    if (err instanceof AppError)
        return res.status(err.statusCode).send({
            error: err.message,
            code: err.code,
            ...(err.details ? { details: err.details } : {}),
        });

    if (err && err.type === 'entity.parse.failed')
        return res.status(400).send({
            error: 'Invalid JSON payload',
            code: 'INVALID_JSON_PAYLOAD',
        });

    return res.status(500).send({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
    });
}

module.exports = errorHandler;
