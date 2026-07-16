import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import type { PostgresRuntimeConfig } from '@/config/runtime';
import * as schema from '@/database/schema';

export type Database = NodePgDatabase<typeof schema>;
export type PostgresReadiness = 'disabled' | 'connected' | 'disconnected';

function toPoolConfig(config: PostgresRuntimeConfig): PoolConfig {
  return {
    connectionString: config.connectionString,
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
    statement_timeout: config.statementTimeoutMillis,
    idle_in_transaction_session_timeout:
      config.idleInTransactionSessionTimeoutMillis,
    application_name: config.applicationName,
  };
}

export class PostgresConnection {
  readonly db: Database;
  private healthy = false;

  constructor(
    config: PostgresRuntimeConfig,
    private readonly pool = new Pool(toPoolConfig(config)),
  ) {
    this.db = drizzle({ client: pool, schema });
    this.pool.on('error', () => {
      this.healthy = false;
    });
  }

  async connect() {
    await this.pool.query('select 1');
    this.healthy = true;
  }

  async readiness(): Promise<Exclude<PostgresReadiness, 'disabled'>> {
    try {
      await this.pool.query('select 1');
      this.healthy = true;
    } catch {
      this.healthy = false;
    }

    return this.healthy ? 'connected' : 'disconnected';
  }

  async close() {
    this.healthy = false;
    await this.pool.end();
  }
}

let activeConnection: PostgresConnection | undefined;

export async function initializePostgres(
  config: PostgresRuntimeConfig,
  pool?: Pool,
) {
  if (activeConnection)
    throw new Error('PostgreSQL connection is already initialized');

  const connection = new PostgresConnection(config, pool);
  await connection.connect();
  activeConnection = connection;
  return connection.db;
}

export function getPostgresDatabase() {
  if (!activeConnection)
    throw new Error('PostgreSQL connection is not initialized');
  return activeConnection.db;
}

export async function getPostgresReadiness(): Promise<PostgresReadiness> {
  return activeConnection ? activeConnection.readiness() : 'disabled';
}

export async function closePostgres() {
  const connection = activeConnection;
  activeConnection = undefined;
  if (connection) await connection.close();
}
