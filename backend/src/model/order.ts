import { Schema, model } from 'mongoose';
import { orderStatuses } from '@/orderStatus';

const OrderSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    status: {
      type: String,
      enum: orderStatuses,
      default: 'placed',
      required: true,
    },
  },
  { timestamps: true },
);

OrderSchema.index({ tenantId: 1, buyer: 1, createdAt: -1 });

export default model('order', OrderSchema);
