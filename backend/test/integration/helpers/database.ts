import mongoose from 'mongoose';
import { createSession } from '@/services/sessionService';

export async function connectDatabase() {
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

export async function sessionHeaders(
  userId: mongoose.Types.ObjectId,
  tenantId = 'mercadozetta',
  tokenVersion = 0,
) {
  const credentials = await createSession(
    String(userId),
    tenantId,
    tokenVersion,
    'integration test',
    new Date(),
  );
  return {
    Cookie: `mz_at=${credentials.accessToken}; mz_csrf=${credentials.csrfToken}`,
    Origin: 'http://localhost:5173',
    'X-CSRF-Token': credentials.csrfToken,
  };
}
