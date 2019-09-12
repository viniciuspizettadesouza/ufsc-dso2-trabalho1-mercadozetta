import { Schema } from "mongoose";

const { } = require('mongoose');

const UserSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
    },
    user: {
        type: String,
    },
    telephone: {
        type: String,
    },
    avatar: {
        type: String,
    },
}, {
    timestamps: true,
});

module.exports = model('user', UserSchema);