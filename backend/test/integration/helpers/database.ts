import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export const jwtSecret = 'integration-test-secret';

export async function connectDatabase() {
  process.env.JWT_SECRET = jwtSecret;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required for integration tests');

  await mongoose.connect(uri);
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes()),
  );
}

export async function clearDatabase() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function authorization(
  userId: mongoose.Types.ObjectId,
  tenantId = 'mercadozetta',
  tokenVersion = 0,
) {
  return `Bearer ${jwt.sign(
    { id: String(userId), tenantId, tokenVersion },
    jwtSecret,
  )}`;
}
