const bcrypt = require('bcryptjs');
const User = require('../model/User');

module.exports = {

    async authenticate(req, res) {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select('password');
        if (!user)
            return res.status(400).send({ error: 'User not found' })

        if (!await bcrypt.compare(password, user.password))
            return res.status(400).send({ error: 'Invalid password' })

        user.password = undefined;
        res.send({ email });
    },
};