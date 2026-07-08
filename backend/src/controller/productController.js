const sendError = require('../errors/sendError');
const ProductService = require('../services/productService');

module.exports = {
    async index(req, res) {
        try {
            const products = await ProductService.listProducts(req.tenant.id);
            return res.status(200).send(products);
        } catch (err) {
            return sendError(res, err, 'Failed to list products');
        }
    },

    async add(req, res) {
        try {
            const newProduct = await ProductService.createProduct(req.body, req.userId, req.tenant.id);
            return res.status(201).send({ newProduct });
        } catch (err) {
            return sendError(res, err, 'Product registration failed');
        }
    },

    async listBySeller(req, res) {
        const userId = req.params.userId || req.params.userID;

        try {
            const products = await ProductService.listProductsBySeller(userId, req.tenant.id);
            return res.status(200).send(products);
        } catch (err) {
            return sendError(res, err, 'Failed to list seller products');
        }
    }
};
