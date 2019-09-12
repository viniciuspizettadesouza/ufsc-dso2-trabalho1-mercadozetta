const express = require('express');
const userController = require('./controller/userController');

const routes = express.Router();

routes.get('/', (req, res) => {
    return res.json({ message: `Hello ${req.query.name}` });
})

routes.post('/users', userController.store);

module.exports = routes;