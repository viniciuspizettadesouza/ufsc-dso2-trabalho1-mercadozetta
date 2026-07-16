import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closePostgres, initializePostgres } from '@/database/postgres';
import { getPostgresRuntimeConfig } from '@/config/runtime';

async function run() {
  const config = getPostgresRuntimeConfig();
  if (!config)
    throw new Error('POSTGRESQL_URL environment variable is required');

  const db = await initializePostgres(config);
  await migrate(db, {
    migrationsFolder: process.env.DRIZZLE_MIGRATIONS_DIR || 'drizzle',
  });
  console.log('PostgreSQL migrations applied');
}

run()
  .catch((error) => {
    console.error('PostgreSQL migration failed', error);
    process.exitCode = 1;
  })
  .finally(closePostgres);
