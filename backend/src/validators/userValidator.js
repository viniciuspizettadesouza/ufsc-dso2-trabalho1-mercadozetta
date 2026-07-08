const AppError = require('../errors/AppError');

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCreateUserPayload(body = {}) {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const username = String(body.username || '').trim();
    const telephone = String(body.telephone || '').trim();

    if (!email || !password || !username || !telephone)
        throw new AppError(400, 'MISSING_USER_FIELDS', 'Email, password, username and telephone are required');

    if (!isValidEmail(email))
        throw new AppError(400, 'INVALID_EMAIL', 'Invalid email');

    return {
        email,
        password,
        username,
        telephone,
    };
}

module.exports = {
    validateCreateUserPayload,
};
