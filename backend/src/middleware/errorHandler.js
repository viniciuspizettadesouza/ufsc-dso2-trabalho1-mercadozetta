const AppError = require('../errors/AppError');

function errorHandler(err, req, res, next) {
    if (res.headersSent)
        return next(err);

    if (err instanceof AppError)
        return res.status(err.statusCode).send({ error: err.message });

    if (err && err.type === 'entity.parse.failed')
        return res.status(400).send({ error: 'Invalid JSON payload' });

    return res.status(500).send({ error: 'Internal server error' });
}

module.exports = errorHandler;
