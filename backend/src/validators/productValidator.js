const mongoose = require('mongoose');
const AppError = require('../errors/AppError');
const { productStatuses } = require('../productStatus');

function validateCreateProductPayload(body = {}) {
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'general').trim().toLowerCase();
    const subcategory = String(body.subcategory || '').trim().toLowerCase();
    const rawInventory = body.inventory ?? body.quant;
    const image = String(body.image || '').trim();
    const inventory = Number(rawInventory);
    const status = body.status === undefined || body.status === null || body.status === ''
        ? 'active'
        : String(body.status).trim();

    if (!name || rawInventory === undefined || rawInventory === null || rawInventory === '' || !image)
        throw new AppError(400, 'MISSING_PRODUCT_FIELDS', 'Name, quantity and image are required');

    if (!Number.isInteger(inventory) || inventory < 0)
        throw new AppError(400, 'INVALID_PRODUCT_INVENTORY', 'Quantity must be a non-negative integer');

    if (!productStatuses.includes(status))
        throw new AppError(400, 'INVALID_PRODUCT_STATUS', 'Product status must be draft, active, paused, sold_out, or archived');

    return {
        name,
        description,
        category,
        subcategory,
        inventory,
        image,
        status,
    };
}

function validateProductId(productId) {
    const id = String(productId || '').trim();

    if (!id)
        throw new AppError(400, 'INVALID_PRODUCT_ID', 'Invalid product id');

    return id;
}

function validateSellerId(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId))
        throw new AppError(400, 'INVALID_SELLER_ID', 'Invalid seller id');

    return userId;
}

module.exports = {
    validateCreateProductPayload,
    validateProductId,
    validateSellerId,
};
