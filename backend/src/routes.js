const express = require('express');
const AuthController = require('./controller/AuthController');
const UserController = require('./controller/UserController');
const ProductController = require('./controller/ProductController');

const routes = express.Router();

routes.get('/products', ProductController.index);

routes.post('/login', AuthController.authenticate);

routes.post('/register-product', ProductController.add);

routes.post('/register-user', UserController.register);

routes.post('/user/:userID/addproduct', ProductController.add);

module.exports = routes;