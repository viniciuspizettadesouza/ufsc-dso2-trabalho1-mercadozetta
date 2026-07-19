import { getAllowedCorsOrigins, isLocalEnv } from '@/config/security';
import { readBoundedInteger as parseBoundedInteger } from '@/config/environment';

const DEFAULT_PORT = 3333;
const DEFAULT_POSTGRES_POOL_MAX = 10;
const DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS = 5000;
const DEFAULT_POSTGRES_IDLE_TIMEOUT_MS = 30000;
const DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS = 10000;
const DEFAULT_POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS = 10000;

export type PostgresRuntimeConfig = {
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statementTimeoutMillis: number;
  idleInTransactionSessionTimeoutMillis: number;
  applicationName: string;
};

export function getPostgresRuntimeConfig(): PostgresRuntimeConfig | undefined {
  const connectionString = process.env.POSTGRESQL_URL?.trim();
  if (!connectionString) return undefined;

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('POSTGRESQL_URL must be a valid PostgreSQL connection URL');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('POSTGRESQL_URL must be a valid PostgreSQL connection URL');
  }

  return {
    connectionString,
    max: parseBoundedInteger(
      'POSTGRES_POOL_MAX',
      DEFAULT_POSTGRES_POOL_MAX,
      1,
      50,
    ),
    connectionTimeoutMillis: parseBoundedInteger(
      'POSTGRES_CONNECTION_TIMEOUT_MS',
      DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
      100,
      30000,
    ),
    idleTimeoutMillis: parseBoundedInteger(
      'POSTGRES_IDLE_TIMEOUT_MS',
      DEFAULT_POSTGRES_IDLE_TIMEOUT_MS,
      1000,
      120000,
    ),
    statementTimeoutMillis: parseBoundedInteger(
      'POSTGRES_STATEMENT_TIMEOUT_MS',
      DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
      100,
      60000,
    ),
    idleInTransactionSessionTimeoutMillis: parseBoundedInteger(
      'POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS',
      DEFAULT_POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS,
      100,
      60000,
    ),
    applicationName: 'mercadozetta-api',
  };
}

function parsePort() {
  const configured = process.env.PORT?.trim();
  if (!configured) {
    if (isLocalEnv()) return DEFAULT_PORT;
    throw new Error('PORT is required outside development and test');
  }

  const port = Number(configured);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function getTrustProxyHops() {
  const configured = process.env.TRUST_PROXY_HOPS?.trim();
  if (!configured) return 0;

  const hops = Number(configured);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }

  return hops;
}

function validateCorsOrigins() {
  const origins = getAllowedCorsOrigins();
  if (!origins.length && !isLocalEnv()) {
    throw new Error('CORS_ORIGIN is required outside development and test');
  }

  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }
  }
}

export function getRuntimeConfig() {
  const postgres = getPostgresRuntimeConfig();
  if (!postgres)
    throw new Error('POSTGRESQL_URL environment variable is required');

  if (!isLocalEnv() && !process.env.TRUST_PROXY_HOPS?.trim()) {
    throw new Error(
      'TRUST_PROXY_HOPS is required outside development and test',
    );
  }

  validateCorsOrigins();

  return {
    postgres,
    port: parsePort(),
    trustProxyHops: getTrustProxyHops(),
  };
}
