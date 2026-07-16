import mongoose from 'mongoose';
import app from '@/app';
import { validateSecurityConfig } from '@/config/security';
import dotenv from 'dotenv';
import { Server } from 'http';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
const port = Number(process.env.PORT) || 3333;

if (!mongoUri) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

try {
  validateSecurityConfig();
} catch (error) {
  console.error('Invalid security configuration', error);
  process.exit(1);
}

let server: Server | undefined;

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);

  if (server)
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => {
        if (err) return reject(err);

        console.log('HTTP server closed');
        return resolve();
      });
    });

  await mongoose.connection.close();
  process.exit(0);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected');
    server = app.listen(port, () =>
      console.log(`Server running on port ${port}`),
    );
  })
  .catch((err) => {
    console.error('MongoDB connection failed', err);
    process.exit(1);
  });

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
