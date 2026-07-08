const AppError = require('../errors/AppError');
const User = require('../model/user');
const { validateCreateUserPayload } = require('../validators/userValidator');

function getDuplicateField(err) {
    if (err.code !== 11000)
        return null;

    const fields = Object.keys(err.keyPattern || err.keyValue || {});

    return fields[0] || null;
}

async function createUser(body) {
    const payload = validateCreateUserPayload(body);

    try {
        if (await User.findOne({ email: payload.email }))
            throw new AppError(400, 'USER_EXISTS', 'User already exists');

        const newUser = await User.create(payload);
        newUser.password = undefined;

        return newUser;
    } catch (err) {
        const duplicateField = getDuplicateField(err);

        if (duplicateField === 'email')
            throw new AppError(400, 'USER_EXISTS', 'User already exists');

        throw err;
    }
}

module.exports = {
    createUser,
};
