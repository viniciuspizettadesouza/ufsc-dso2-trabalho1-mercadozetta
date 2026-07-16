import 'dotenv/config';
import { createApp } from '@/app';
import { createPostgresComposition } from '@/compositionRoot';
import { validateSecurityConfig } from '@/config/security';
import { getRuntimeConfig } from '@/config/runtime';
import { closePostgres, initializePostgres } from '@/database/postgres';
import { getPostgresReadiness } from '@/database/postgres';
import { createRoutes } from '@/routes';
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

  await closePostgres();
  process.exit(0);
}

async function start() {
  try {
    const db = await initializePostgres(runtime.postgres);
    console.log('PostgreSQL connected');
    const composition = createPostgresComposition(db);
    const readiness = async () => {
      const postgresql = await getPostgresReadiness();
      return {
        ready: postgresql === 'connected',
        checks: { postgresql },
      };
    };

    const app = createApp(createRoutes({ ...composition, readiness }));
    server = app.listen(runtime.port, () =>
      console.log(`Server running on port ${runtime.port}`),
    );
  } catch (err) {
    console.error('Database connection failed', err);
    await closePostgres();
    process.exit(1);
  }
}

void start();

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
