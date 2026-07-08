const Product = require('../model/product');
const {
    validateCreateProductPayload,
    validateSellerId,
} = require('../validators/productValidator');

async function listProducts() {
    return Product.find({});
}

async function createProduct(body, seller) {
    const payload = validateCreateProductPayload(body);

    return Product.create({
        ...payload,
        seller,
    });
}

async function listProductsBySeller(userId) {
    const seller = validateSellerId(userId);

    return Product.find({ seller });
}

module.exports = {
    createProduct,
    listProducts,
    listProductsBySeller,
};
