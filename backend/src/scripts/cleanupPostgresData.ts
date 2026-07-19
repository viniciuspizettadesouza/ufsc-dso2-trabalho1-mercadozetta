import 'dotenv/config';
import { getDataCleanupConfig } from '@/config/dataCleanup';
import { getPostgresRuntimeConfig } from '@/config/runtime';
import { closePostgres, initializePostgres } from '@/database/postgres';
import { logger } from '@/logging';
import { PostgresDataCleanupRepository } from '@/repositories/postgres/dataCleanupRepository';
import { runDataCleanup } from '@/services/dataCleanupService';

async function run() {
  const postgresConfig = getPostgresRuntimeConfig();
  if (!postgresConfig)
    throw new Error('POSTGRESQL_URL environment variable is required');
  const cleanupConfig = getDataCleanupConfig();
  const database = await initializePostgres(postgresConfig);
  await runDataCleanup(
    new PostgresDataCleanupRepository(database),
    cleanupConfig,
    new Date(),
    logger,
  );
}

run()
  .catch((error) => {
    logger.error({ err: error, event: 'data_cleanup_failed' });
    process.exitCode = 1;
  })
  .finally(closePostgres);
