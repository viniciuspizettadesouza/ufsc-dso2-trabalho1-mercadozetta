import { Schema, model } from 'mongoose';

const ReviewSchema = new Schema({
  tenantId: { type: String, required: true, index: true },
  product: { type: Schema.Types.ObjectId, ref: 'product', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true },
}, { timestamps: true });

ReviewSchema.index({ tenantId: 1, product: 1, author: 1 }, { unique: true });

export default model('review', ReviewSchema);
