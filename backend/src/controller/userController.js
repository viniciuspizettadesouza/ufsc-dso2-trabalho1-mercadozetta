const sendError = require('../errors/sendError');
const UserService = require('../services/userService');

module.exports = {
    async add(req, res) {
        try {
            const newUser = await UserService.createUser(req.body, req.tenant.id);
            return res.status(201).send({ newUser });
        } catch (err) {
            return sendError(res, err, 'Registration failed');
        }
    }
};
