const User = require('../model/user');

module.exports = {
    login(req, res) {
        let { email, password } = req.body;

        User.findOne({ email: email, password: password }, function (err, email) {
            if (err) {
                console.log(err);
                return res.status(500).send();
            }
            if (!email) {
                return res.status(404).send();
            }
            console.log("Logado com sucesso")
            return res.status(200).send();
        })
    },

    async register(req, res) {
        let { email, password, firstname, telephone } = req.body;

        const userExists = await User.findOne({ user: email });

        if (userExists) {
            return res.json(userExists)
        }

        const newUser = await User.create({
            email: email,
            password: password,
            firstname: firstname,
            telephone: telephone,
        })

        newUser.save(function (err, savedUser) {
            if (err) {
                console.log(err);
                return res.status(500).send();
            }
            console.log("Cadastrado com sucesso")
            return res.status(200).send();
        })
    },
};