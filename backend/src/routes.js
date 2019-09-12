const express = require('express');
const UserController = require('./controller/UserController');

const routes = express.Router();

routes.get('/', (req, res) => {
    return res.json({ message: `Hello ${req.query.name}` });
})

routes.post('/login', UserController.login);

routes.post('/register', UserController.register);

module.exports = routes;