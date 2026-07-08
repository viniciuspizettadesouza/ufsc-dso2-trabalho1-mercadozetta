const { Schema, model } = require('mongoose');
const { defaultTenantId } = require('../tenants');
const { productStatuses } = require('../productStatus');

const ProductSchema = new Schema({
    tenantId: {
        type: String,
        required: true,
        default: defaultTenantId,
        index: true,
    },
    name: {
        type: String,
        required: true,
        lowercase: true,
    },
    description: {
        type: String,
    },
    inventory: {
        type: Number,
        required: true,
        min: 0,
    },
    image: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: productStatuses,
        default: 'active',
        required: true,
    },
    seller: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    }
}, {
    timestamps: true,
});

ProductSchema.index({ tenantId: 1, seller: 1 });
ProductSchema.index({ tenantId: 1, name: 'text', description: 'text' });

module.exports = model('product', ProductSchema);
