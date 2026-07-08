const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');
const User = require('../model/user');
const { validateLoginPayload } = require('../validators/authValidator');

async function authenticate(body) {
    const { email, password } = validateLoginPayload(body);
    const user = await User.findOne({ email }).select('+password email username telephone');

    if (!user)
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    if (!await bcrypt.compare(password, user.password))
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    user.password = undefined;

    const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'mercadozetta-dev-secret',
        { expiresIn: '1d' }
    );

    return {
        user,
        token,
    };
}

module.exports = {
    authenticate,
};
