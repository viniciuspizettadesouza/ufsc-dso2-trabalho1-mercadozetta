const Product = require('../model/Product');

module.exports = {
    // index de pesquisa de produtos ta bugado
    // está retornando o objeto todo
    // falta filtrar só os produtos do objeto user

    async index(req, res) {

        const products = await Product.find({}, function (err, name) {
            return (null, name)
        });
        console.log(products);
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