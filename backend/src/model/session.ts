import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const SessionSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    familyId: { type: String, required: true },
    tokenVersion: { type: Number, required: true, min: 0 },
    refreshTokenHash: { type: String, required: true, select: false },
    refreshTokenSecretVersion: {
      type: String,
      match: /^[A-Za-z\d_-]{1,32}$/,
    },
    previousRefreshTokenHash: { type: String, select: false },
    previousRefreshTokenSecretVersion: {
      type: String,
      match: /^[A-Za-z\d_-]{1,32}$/,
    },
    rotationCounter: { type: Number, required: true, default: 0, min: 0 },
    rotatedAt: { type: Date },
    lastUsedAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokeReason: { type: String },
    userAgentLabel: { type: String, maxlength: 120 },
  },
  { timestamps: true },
);

SessionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
SessionSchema.index({ tenantId: 1, familyId: 1 }, { unique: true });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = model('session', SessionSchema);

export type SessionRecord = InferSchemaType<typeof SessionSchema> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export default Session;
