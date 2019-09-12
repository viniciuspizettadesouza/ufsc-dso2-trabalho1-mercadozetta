const express = require('express');

const routes = express.Router();

routes.get('/', (req, res) => {
    return res.json({ message: `Hello ${req.query.name}` })
})

routes.post('/users', (req, res) => {
    return res.json({ ok: true })
})

module.exports = routes