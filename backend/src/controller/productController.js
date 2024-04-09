const Product = require('../model/product');

module.exports = {
    async index(req, res) {

        const products = await Product.find({}, function (err, name) {
            return (null, name)
        });
        return res.status(200).send(products);
    },

    async add(req, res) {
        try {
            const newProduct = await Product.create(req.body);
            return res.status(200).send({ newProduct });
        } catch (err) {
            return res.status(400).send({ error: 'Product registration failed' });
        }
    }
};