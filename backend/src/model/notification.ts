import { Schema, model } from 'mongoose';

const NotificationSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, required: true },
  },
  { timestamps: true },
);

NotificationSchema.index({ tenantId: 1, user: 1, createdAt: -1 });

export default model('notification', NotificationSchema);
