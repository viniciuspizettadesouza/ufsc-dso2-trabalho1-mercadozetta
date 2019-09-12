const User = require('../model/User');

module.exports = {

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