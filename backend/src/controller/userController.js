const User = require('../model/User');

module.exports = {
    async add(req, res) {
        const { email } = req.body;

        try {
            if (await User.findOne({ email }))
                return res.status(400).send({ error: 'User already exists' });
            const newUser = await User.create(req.body);
            newUser.password = undefined;
            return res.status(200).send({ newUser });
        } catch (err) {
            return res.status(400).send({ error: 'Registration failed' });
        }
    }
};