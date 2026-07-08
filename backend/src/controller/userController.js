const UserService = require('../services/userService');

module.exports = {
    async add(req, res) {
        const newUser = await UserService.createUser(req.validated.body, req.tenant.id);
        return res.status(201).send({ newUser });
    },

    async sellerProfile(req, res) {
        const seller = await UserService.getPublicSellerProfile(req.params.userId, req.tenant.id);
        return res.status(200).send(seller);
    }
};
