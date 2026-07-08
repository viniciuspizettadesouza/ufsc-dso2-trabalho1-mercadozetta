const sendError = require('../errors/sendError');
const AuthService = require('../services/authService');

module.exports = {
    async authenticate(req, res) {
        try {
            const result = await AuthService.authenticate(req.body, req.tenant.id);
            return res.send(result);
        } catch (err) {
            return sendError(res, err, 'Authentication failed');
        }
    },
};
