import { Schema, model, Types, type InferSchemaType } from 'mongoose';
import bcrypt from 'bcryptjs';
import { defaultTenantId } from '@/tenants';

const UserSchema = new Schema(
  {
    tenantId: {
      type: String,
      required: true,
      default: defaultTenantId,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
      select: false,
    },
    username: {
      type: String,
      lowercase: true,
    },
    telephone: {
      type: String,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const hash = await bcrypt.hash(this.password, 10);
  this.password = hash;
});

const User = model('user', UserSchema);
export type UserRecord = InferSchemaType<typeof UserSchema> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
export default User;
