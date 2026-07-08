const AuthService = require('../services/authService');

module.exports = {
    async authenticate(req, res) {
        const result = await AuthService.authenticate(req.validated.body, req.tenant.id);
        return res.status(200).send(result);
    },
};
