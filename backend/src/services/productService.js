const Product = require('../model/product');
const { defaultTenantId } = require('../tenants');
const {
    validateCreateProductPayload,
    validateSellerId,
} = require('../validators/productValidator');

async function listProducts(tenantId = defaultTenantId) {
    return Product.find({ tenantId });
}

async function createProduct(body, seller, tenantId = defaultTenantId) {
    const payload = validateCreateProductPayload(body);

    return Product.create({
        ...payload,
        tenantId,
        seller,
    });
}

async function listProductsBySeller(userId, tenantId = defaultTenantId) {
    const seller = validateSellerId(userId);

    return Product.find({ tenantId, seller });
}

module.exports = {
    createProduct,
    listProducts,
    listProductsBySeller,
};
