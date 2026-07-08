const express = require('express');
const mongoose = require('mongoose');
const AuthController = require('./controller/authController');
const UserController = require('./controller/userController');
const ProductController = require('./controller/productController');
const authMiddleware = require('./middleware/auth');
const { authRateLimiter, registerRateLimiter } = require('./middleware/rateLimit');

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

routes.get('/products', ProductController.index);

routes.get('/products/:productId', ProductController.detail);

routes.get('/users/:userId', UserController.sellerProfile);

routes.get('/users/:userId/products', ProductController.listBySeller);

routes.post('/users', registerRateLimiter, UserController.add);

routes.post('/auth/login', authRateLimiter, AuthController.authenticate);

routes.post('/products', authMiddleware, ProductController.add);

module.exports = routes;
