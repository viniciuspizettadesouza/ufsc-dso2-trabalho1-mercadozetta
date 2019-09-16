const { Schema, model } = require('mongoose');

const ProductSchema = new Schema({
    name: {
        type: String,
        required: true,
        lowercase: true,
    },
    description: {
        type: String,
    },
    quant: {
        type: String,
        required: true,
    }
}, {
    timestamps: true,
});

module.exports = model('product', ProductSchema);