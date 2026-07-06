const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/user');

module.exports = {
    async authenticate(req, res) {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).send({ error: 'Email and password are required' });

        const user = await User.findOne({ email }).select('+password email username telephone');
        if (!user)
            return res.status(401).send({ error: 'Invalid credentials' });

        if (!await bcrypt.compare(password, user.password))
            return res.status(401).send({ error: 'Invalid credentials' });

        user.password = undefined;

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'mercadozetta-dev-secret',
            { expiresIn: '1d' }
        );

        return res.send({
            user,
            token,
        });
    },
};
