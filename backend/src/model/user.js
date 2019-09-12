const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true
    },
    firstname: String,
    telephone: String,
}, {
    timestamps: true,
});

module.exports = model('user', UserSchema);