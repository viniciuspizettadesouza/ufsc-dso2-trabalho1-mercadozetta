const AppError = require('../errors/AppError');

function validateLoginPayload(body = {}) {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password)
        throw new AppError(400, 'MISSING_CREDENTIALS', 'Email and password are required');

    return { email, password };
}

module.exports = {
    validateLoginPayload,
};
