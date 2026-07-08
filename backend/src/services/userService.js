const AppError = require('../errors/AppError');
const User = require('../model/user');
const { defaultTenantId } = require('../tenants');
const { validateCreateUserPayload } = require('../validators/userValidator');

function getDuplicateField(err) {
    if (err.code !== 11000)
        return null;

    const fields = Object.keys(err.keyPattern || err.keyValue || {});

    return fields[0] || null;
}

async function createUser(body, tenantId = defaultTenantId) {
    const payload = validateCreateUserPayload(body);

    try {
        if (await User.findOne({ tenantId, email: payload.email }))
            throw new AppError(400, 'USER_EXISTS', 'User already exists');

        const newUser = await User.create({
            ...payload,
            tenantId,
        });
        newUser.password = undefined;

        return newUser;
    } catch (err) {
        const duplicateField = getDuplicateField(err);

        if (duplicateField === 'email' || duplicateField === 'tenantId')
            throw new AppError(400, 'USER_EXISTS', 'User already exists');

        throw err;
    }
}

async function getPublicSellerProfile(userId, tenantId = defaultTenantId) {
    const seller = await User.findOne({ _id: userId, tenantId });

    if (!seller)
        throw new AppError(404, 'SELLER_NOT_FOUND', 'Seller not found');

    return {
        _id: seller._id,
        username: seller.username,
        telephone: seller.telephone,
        email: seller.email,
        storeName: seller.username ? `${seller.username} store` : 'Seller store',
    };
}

module.exports = {
    createUser,
    getPublicSellerProfile,
};
