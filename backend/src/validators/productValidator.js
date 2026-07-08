const mongoose = require('mongoose');
const AppError = require('../errors/AppError');

function validateCreateProductPayload(body = {}) {
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const quant = String(body.quant || '').trim();
    const image = String(body.image || '').trim();

    if (!name || !quant || !image)
        throw new AppError(400, 'MISSING_PRODUCT_FIELDS', 'Name, quantity and image are required');

    return {
        name,
        description,
        quant,
        image,
    };
}

function validateSellerId(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId))
        throw new AppError(400, 'INVALID_SELLER_ID', 'Invalid seller id');

    return userId;
}

module.exports = {
    validateCreateProductPayload,
    validateSellerId,
};
