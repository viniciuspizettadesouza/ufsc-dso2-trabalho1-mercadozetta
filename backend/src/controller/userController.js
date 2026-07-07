const User = require('../model/user');

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
    async add(req, res) {
        const body = req.body || {};
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const username = String(body.username || '').trim();
        const telephone = String(body.telephone || '').trim();

        if (!email || !password || !username || !telephone)
            return res.status(400).send({ error: 'Email, password, username and telephone are required' });

        if (!isValidEmail(email))
            return res.status(400).send({ error: 'Invalid email' });

        try {
            if (await User.findOne({ email }))
                return res.status(400).send({ error: 'User already exists' });

            const newUser = await User.create({
                email,
                password,
                username,
                telephone,
            });

            newUser.password = undefined;
            return res.status(201).send({ newUser });
        } catch (err) {
            return res.status(400).send({ error: 'Registration failed' });
        }
    }
};
