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
    },
    image: {
        type: String,
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

module.exports = model('product', ProductSchema);
