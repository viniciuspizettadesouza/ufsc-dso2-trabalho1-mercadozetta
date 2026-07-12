import { Schema, model } from 'mongoose';

const WatchlistSchema = new Schema({
  tenantId: { type: String, required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  product: { type: Schema.Types.ObjectId, ref: 'product', required: true },
}, { timestamps: true });

WatchlistSchema.index({ tenantId: 1, user: 1, product: 1 }, { unique: true });

export default model('watchlist', WatchlistSchema);
