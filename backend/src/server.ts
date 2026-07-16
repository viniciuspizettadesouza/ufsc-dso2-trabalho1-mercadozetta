import 'dotenv/config';
import mongoose from 'mongoose';
import app from '@/app';
import { validateSecurityConfig } from '@/config/security';
import { getRuntimeConfig } from '@/config/runtime';
import { Server } from 'http';

let runtime: ReturnType<typeof getRuntimeConfig>;

try {
  validateSecurityConfig();
  runtime = getRuntimeConfig();
} catch (error) {
  console.error('Invalid startup configuration', error);
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
  .connect(runtime.mongoUri)
  .then(() => {
    console.log('MongoDB connected');
    server = app.listen(runtime.port, () =>
      console.log(`Server running on port ${runtime.port}`),
    );
  })
  .catch((err) => {
    console.error('MongoDB connection failed', err);
    process.exit(1);
  });

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
