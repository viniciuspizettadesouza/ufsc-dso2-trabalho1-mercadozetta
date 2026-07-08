const express = require('express');
const mongoose = require('mongoose');
const AuthController = require('./controller/authController');
const UserController = require('./controller/userController');
const ProductController = require('./controller/productController');
const authMiddleware = require('./middleware/auth');
const asyncHandler = require('./middleware/asyncHandler');
const { authRateLimiter, registerRateLimiter } = require('./middleware/rateLimit');
const validateRequest = require('./middleware/validateRequest');
const { validateLoginPayload } = require('./validators/authValidator');
const {
    validateCreateProductPayload,
    validateProductFilters,
    validateProductId,
    validateSellerId,
} = require('./validators/productValidator');
const { validateCreateUserPayload } = require('./validators/userValidator');

const routes = express.Router();

routes.get('/', (req, res) => {
    res.json({ message: 'Welcome to zetta2k app' });
});

routes.get('/health', (req, res) => {
    res.status(200).send({ status: 'ok' });
});

routes.get('/ready', (req, res) => {
    const isReady = mongoose.connection.readyState === 1;

    return res.status(isReady ? 200 : 503).send({
        status: isReady ? 'ready' : 'not_ready',
        checks: {
            mongodb: isReady ? 'connected' : 'disconnected',
        },
    });
});

routes.get(
    '/products',
    validateRequest({ query: validateProductFilters }),
    asyncHandler(ProductController.index)
);

routes.get(
    '/products/:productId',
    validateRequest({
        params: params => ({ productId: validateProductId(params.productId) }),
    }),
    asyncHandler(ProductController.detail)
);

routes.get('/users/:userId', asyncHandler(UserController.sellerProfile));

routes.get(
    '/users/:userId/products',
    validateRequest({
        params: params => ({ userId: validateSellerId(params.userId || params.userID) }),
        query: validateProductFilters,
    }),
    asyncHandler(ProductController.listBySeller)
);

routes.post(
    '/users',
    registerRateLimiter,
    validateRequest({ body: validateCreateUserPayload }),
    asyncHandler(UserController.add)
);

routes.post(
    '/auth/login',
    authRateLimiter,
    validateRequest({ body: validateLoginPayload }),
    asyncHandler(AuthController.authenticate)
);

routes.post(
    '/products',
    authMiddleware,
    validateRequest({ body: validateCreateProductPayload }),
    asyncHandler(ProductController.add)
);

module.exports = routes;
