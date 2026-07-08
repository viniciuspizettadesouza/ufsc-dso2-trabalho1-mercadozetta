const AppError = require('../errors/AppError');
const ProductService = require('../services/productService');

module.exports = {
    async index(req, res) {
        const products = await ProductService.listProducts(req.tenant.id, req.validated.query);
        return res.status(200).send(products);
    },

    async detail(req, res) {
        const product = await ProductService.getProductById(req.validated.params.productId, req.tenant.id);

        if (!product)
            throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

        return res.status(200).send(product);
    },

    async add(req, res) {
        const newProduct = await ProductService.createProduct(req.validated.body, req.userId, req.tenant.id);
        return res.status(201).send({ newProduct });
    },

    async listBySeller(req, res) {
        const products = await ProductService.listProductsBySeller(
            req.validated.params.userId,
            req.tenant.id,
            req.validated.query
        );
        return res.status(200).send(products);
    }
};
