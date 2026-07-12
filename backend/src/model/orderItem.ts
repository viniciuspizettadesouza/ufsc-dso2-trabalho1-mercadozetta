import { Schema, model } from 'mongoose';

const OrderItemSchema = new Schema({
  tenantId: { type: String, required: true, index: true },
  order: { type: Schema.Types.ObjectId, ref: 'order', required: true },
  product: { type: Schema.Types.ObjectId, ref: 'product', required: true },
  seller: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { timestamps: true });

OrderItemSchema.index({ tenantId: 1, order: 1 });
OrderItemSchema.index({ tenantId: 1, seller: 1, createdAt: -1 });

export default model('orderItem', OrderItemSchema);
