const express = require('express');
const UserController = require('./controller/UserController');
const ProductController = require('./controller/ProductController');

const routes = express.Router();

routes.get('/', (req, res) => {
    return res.json({ message: `Hello ${req.query.name}` });
})
routes.get('/products', ProductController.index);

routes.post('/login', UserController.login);

routes.post('/register', UserController.register);

routes.post('/user/:userID/addproduct', ProductController.add);

module.exports = routes;