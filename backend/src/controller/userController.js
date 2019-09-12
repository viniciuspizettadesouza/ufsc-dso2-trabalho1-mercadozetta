const User = require('../model/User');

module.exports = {
    login(req, res) {
        let { email, password } = req.body;

        User.findOne({ email: email, password: password }, function (err, email) {
            if (err) {
                console.log(err);
                return res.status(500).send();
            }
            if (!email) {
                return res.status(404).send({ error: 'User not found' });
            }
            return res.status(200).send(req.body.email);
        })
    },

    async register(req, res) {
        let { email, password, firstname, telephone } = req.body;

        try {
            if (await User.findOne({ email }))
                return res.status(400).send({ error: 'User already exists' });
            const newUser = await User.create(req.body);
            newUser.password = undefined;
            return res.status(200).send({ newUser });
        } catch (err) {
            return res.status(400).send({ error: 'Registration failed' });
        }
    },
};