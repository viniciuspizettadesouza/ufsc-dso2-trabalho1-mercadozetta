const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    username: {
        type: String,
        lowercase: true,
    },
    telephone: {
        type: String,
        lowercase: true,
    }
}, {
    timestamps: true,
});

UserSchema.pre('save', async function () {
    if (!this.isModified('password'))
        return;

    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
});

module.exports = model('user', UserSchema);
