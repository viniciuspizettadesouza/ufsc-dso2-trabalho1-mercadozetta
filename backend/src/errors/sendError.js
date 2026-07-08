const AppError = require('./AppError');

function sendError(res, err, fallbackMessage = 'Request failed') {
    if (err instanceof AppError)
        return res.status(err.statusCode).send({ error: err.message });

    return res.status(400).send({ error: fallbackMessage });
}

module.exports = sendError;
