const express = require('express');
const AuthController = require('./controller/authController');
const UserController = require('./controller/userController');
const ProductController = require('./controller/productController');
const authMiddleware = require('./middleware/auth');

const routes = express.Router();

routes.get("/", (req, res) => {
    res.json({ message: "Welcome to zetta2k app" });
});

routes.get('/products', ProductController.index);

routes.post('/login', AuthController.authenticate);

routes.post('/products', authMiddleware, ProductController.add);

routes.post('/add-product', authMiddleware, ProductController.add);

routes.post('/add-user', UserController.add);

routes.post('/user/:userID/addproduct', authMiddleware, ProductController.add);

module.exports = routes;
