const Product = require('../model/product');
const mongoose = require('mongoose');

module.exports = {
    async index(req, res) {
        try {
            const products = await Product.find({});
            return res.status(200).send(products);
        } catch (err) {
            return res.status(400).send({ error: 'Failed to list products' });
        }
    },

    async add(req, res) {
        const body = req.body || {};
        const name = String(body.name || '').trim();
        const description = String(body.description || '').trim();
        const quant = String(body.quant || '').trim();
        const image = String(body.image || '').trim();

        if (!name || !quant || !image)
            return res.status(400).send({ error: 'Name, quantity and image are required' });

        try {
            const newProduct = await Product.create({
                name,
                description,
                quant,
                image,
                seller: req.userId,
            });

            return res.status(201).send({ newProduct });
        } catch (err) {
            return res.status(400).send({ error: 'Product registration failed' });
        }
    },

    async listBySeller(req, res) {
        const userId = req.params.userId || req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(userId))
            return res.status(400).send({ error: 'Invalid seller id' });

        try {
            const products = await Product.find({ seller: userId });
            return res.status(200).send(products);
        } catch (err) {
            return res.status(400).send({ error: 'Failed to list seller products' });
        }
    }
};
