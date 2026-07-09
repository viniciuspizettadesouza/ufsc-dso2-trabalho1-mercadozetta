import { Schema, model } from 'mongoose';
import { defaultTenantId } from '../tenants';
import { productStatuses } from '../productStatus';

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
  category: {
    type: String,
    trim: true,
    lowercase: true,
    default: 'general',
  },
  subcategory: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
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
  },
}, {
  timestamps: true,
});

ProductSchema.index({ tenantId: 1, seller: 1 });
ProductSchema.index({ tenantId: 1, category: 1, subcategory: 1 });
ProductSchema.index({ tenantId: 1, name: 'text', description: 'text' });

const Product = model('product', ProductSchema);
export default Product;
