const mongoose = require('mongoose');
const AppError = require('../errors/AppError');

function validateCreateProductPayload(body = {}) {
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const rawInventory = body.inventory ?? body.quant;
    const image = String(body.image || '').trim();
    const inventory = Number(rawInventory);

    if (!name || rawInventory === undefined || rawInventory === null || rawInventory === '' || !image)
        throw new AppError(400, 'MISSING_PRODUCT_FIELDS', 'Name, quantity and image are required');

    if (!Number.isInteger(inventory) || inventory < 0)
        throw new AppError(400, 'INVALID_PRODUCT_INVENTORY', 'Quantity must be a non-negative integer');

    return {
        name,
        description,
        inventory,
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
