const User = require('../model/User');

module.exports = {
    login(req, res) {
        let { email, password } = req.body;

        User.findOne({ email: email, password: password }, function (err, email) {
            if (err) {
                return res.status(500).send();
            }
            if (!email) {
                return res.status(404).send({ error: 'User not found' });
            }
            return res.status(200).send(req.body.email);
        })
    },
};