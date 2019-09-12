const User = require('../model/user');

module.exports = {
    async store(req, res) {
        const { username } = req.body;

        const userExists = await User.findOne({ user: username });

        if (userExists) {
            return res.json(userExists)
        }

        const user = await User.create({
            email,
            password,
            name,
            user,
            telephone,
            avatar
        })

        return res.json({ user });
    }
};