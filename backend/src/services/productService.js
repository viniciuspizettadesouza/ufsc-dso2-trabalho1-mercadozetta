const Product = require('../model/product');
const { defaultTenantId } = require('../tenants');
const UserService = require('./userService');
const {
    validateCreateProductPayload,
    validateProductId,
    validateSellerId,
} = require('../validators/productValidator');

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function filterProducts(products, filters = {}) {
    const q = normalizeText(filters.q || filters.search);
    const category = normalizeText(filters.category);
    const subcategory = normalizeText(filters.subcategory);
    const seller = String(filters.seller || '').trim();
    const status = normalizeText(filters.status);
    const availability = normalizeText(filters.availability);

    return products.filter(product => {
        const productName = normalizeText(product.name);
        const description = normalizeText(product.description);
        const productCategory = normalizeText(product.category);
        const productSubcategory = normalizeText(product.subcategory);
        const productStatus = normalizeText(product.status || 'active');
        const productSeller = String(product.seller || '');
        const inventory = Number(product.inventory || 0);

        return (!q || productName.includes(q) || description.includes(q))
            && (!category || productCategory === category)
            && (!subcategory || productSubcategory === subcategory)
            && (!seller || productSeller === seller)
            && (!status || productStatus === status)
            && (!availability
                || (availability === 'in_stock' && inventory > 0)
                || (availability === 'sold_out' && inventory === 0));
    });
}

function sortProducts(products, sort) {
    const sortedProducts = [...products];

    switch (sort) {
        case 'created_asc':
            return sortedProducts.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        case 'name_asc':
            return sortedProducts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        case 'inventory_desc':
            return sortedProducts.sort((a, b) => Number(b.inventory || 0) - Number(a.inventory || 0));
        case 'created_desc':
        default:
            return sortedProducts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
}

async function listProducts(tenantId = defaultTenantId, filters = {}) {
    const products = await Product.find({ tenantId });

    return sortProducts(filterProducts(products, filters), filters.sort);
}

async function createProduct(body, seller, tenantId = defaultTenantId) {
    const payload = validateCreateProductPayload(body);

    return Product.create({
        ...payload,
        tenantId,
        seller,
    });
}

async function getProductById(productId, tenantId = defaultTenantId) {
    const _id = validateProductId(productId);
    const product = await Product.findOne({ _id, tenantId });

    if (!product)
        return null;

    try {
        const seller = await UserService.getPublicSellerProfile(product.seller, tenantId);
        return { ...product, sellerProfile: seller };
    } catch {
        return product;
    }
}

async function listProductsBySeller(userId, tenantId = defaultTenantId, filters = {}) {
    const seller = validateSellerId(userId);
    const products = await Product.find({ tenantId, seller });

    return sortProducts(filterProducts(products, filters), filters.sort);
}

module.exports = {
    createProduct,
    getProductById,
    listProducts,
    listProductsBySeller,
};
