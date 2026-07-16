import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const connectionUrl = process.env.POSTGRESQL_URL?.trim();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  migrations: { prefix: 'index' },
  strict: true,
  verbose: true,
  ...(connectionUrl ? { dbCredentials: { url: connectionUrl } } : {}),
});
