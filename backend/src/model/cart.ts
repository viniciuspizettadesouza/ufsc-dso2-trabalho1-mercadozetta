import { Schema, model } from 'mongoose';

const CartSchema = new Schema({
  tenantId: { type: String, required: true, index: true },
  buyer: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'product', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  }],
}, { timestamps: true });

CartSchema.index({ tenantId: 1, buyer: 1 }, { unique: true });

export default model('cart', CartSchema);
