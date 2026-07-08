const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/security');
const AppError = require('../errors/AppError');
const User = require('../model/user');
const { defaultTenantId } = require('../tenants');
const { validateLoginPayload } = require('../validators/authValidator');

async function authenticate(body, tenantId = defaultTenantId) {
    const { email, password } = validateLoginPayload(body);
    const user = await User.findOne({ tenantId, email }).select('+password email username telephone tenantId');

    if (!user)
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    if (!await bcrypt.compare(password, user.password))
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    user.password = undefined;

    const token = jwt.sign(
        { id: user._id, tenantId },
        getJwtSecret(),
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
