const User = require('../model/User');

module.exports = {
    // index de pesquisa de produtos ta bugado
    // está retornando o objeto todo
    // falta filtrar só os produtos do objeto

    async index(req, res) {
        const { user } = req.headers;
        const loggedUser = await User.findById(user);

        const products = await User.find({
            $and: [
                { id_: { $in: loggedUser.products } }
            ],
        })

        return res.status(200).send(products);

    },

    async add(req, res) {
        try {
            const { product } = req.headers;
            const { userID } = req.params;
            const loggedUser = await User.findById(userID);
            if (!loggedUser) {
                return res.status(404).json({ error: 'User not found' });
            }
            loggedUser.products.push(product);

            await loggedUser.save();
            return res.status(200).send(loggedUser);
        } catch (err) {
            return res.status(400).send({ error: 'Product registration failed' });
        }
    }
};