import 'dotenv/config';
import { createApp } from '@/app';
import { createPostgresComposition } from '@/compositionRoot';
import { validateSecurityConfig } from '@/config/security';
import { getRuntimeConfig } from '@/config/runtime';
import { closePostgres, initializePostgres } from '@/database/postgres';
import { getPostgresReadiness } from '@/database/postgres';
import { createRoutes } from '@/routes';
import { Server } from 'http';
import { logger } from '@/logging';

let runtime: ReturnType<typeof getRuntimeConfig>;

try {
  validateSecurityConfig();
  runtime = getRuntimeConfig();
} catch (error) {
  logger.fatal({ err: error, event: 'startup_configuration_invalid' });
  process.exit(1);
}

let server: Server | undefined;

async function shutdown(signal: string) {
  logger.info({ event: 'shutdown_started', signal });

  if (server)
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => {
        if (err) return reject(err);

        logger.info({ event: 'http_server_closed' });
        return resolve();
      });
    });

  await closePostgres();
  process.exit(0);
}

async function start() {
  try {
    const db = await initializePostgres(runtime.postgres);
    logger.info({ event: 'postgresql_connected' });
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
      logger.info({ event: 'http_server_started', port: runtime.port }),
    );
  } catch (err) {
    logger.fatal({ err, event: 'application_start_failed' });
    await closePostgres();
    process.exit(1);
  }
}

void start();

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
