const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const { defaultTenantId } = require('../tenants');

const UserSchema = new Schema({
    tenantId: {
        type: String,
        required: true,
        default: defaultTenantId,
        index: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
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

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

UserSchema.pre('save', async function () {
    if (!this.isModified('password'))
        return;

    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
});

module.exports = model('user', UserSchema);
