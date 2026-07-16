import { afterEach, describe, expect, it } from 'vitest';
import {
  getPostgresRuntimeConfig,
  getRuntimeConfig,
  getTrustProxyHops,
} from '@/config/runtime';

describe('runtime config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses local port and proxy defaults', () => {
    process.env = {
      NODE_ENV: 'test',
      POSTGRESQL_URL: 'postgresql://app:secret@localhost:5432/mercadozetta',
    };

    expect(getRuntimeConfig()).toEqual({
      postgres: expect.objectContaining({
        connectionString: 'postgresql://app:secret@localhost:5432/mercadozetta',
      }),
      port: 3333,
      trustProxyHops: 0,
    });
  });

  it('accepts complete production runtime configuration', () => {
    process.env = {
      NODE_ENV: 'production',
      POSTGRESQL_URL: 'postgresql://app:secret@postgres:5432/mercadozetta',
      PORT: '4000',
      TRUST_PROXY_HOPS: '1',
      CORS_ORIGIN: 'https://market.example.com,https://admin.example.com',
    };

    expect(getRuntimeConfig()).toEqual({
      postgres: expect.objectContaining({
        connectionString: 'postgresql://app:secret@postgres:5432/mercadozetta',
      }),
      port: 4000,
      trustProxyHops: 1,
    });
  });

  it('rejects missing production variables and invalid values', () => {
    process.env = { NODE_ENV: 'production' };
    expect(() => getRuntimeConfig()).toThrow('POSTGRESQL_URL');

    process.env.POSTGRESQL_URL =
      'postgresql://app:secret@postgres:5432/mercadozetta';
    expect(() => getRuntimeConfig()).toThrow('TRUST_PROXY_HOPS');

    process.env.TRUST_PROXY_HOPS = '1';
    expect(() => getRuntimeConfig()).toThrow('CORS_ORIGIN');

    process.env.CORS_ORIGIN = 'not-an-origin';
    expect(() => getRuntimeConfig()).toThrow('invalid origin');

    process.env.CORS_ORIGIN = 'ftp://market.example.com';
    expect(() => getRuntimeConfig()).toThrow('invalid origin');

    process.env.CORS_ORIGIN = 'https://market.example.com/path';
    expect(() => getRuntimeConfig()).toThrow('invalid origin');

    process.env.CORS_ORIGIN = 'https://market.example.com';
    expect(() => getRuntimeConfig()).toThrow('PORT');
  });

  it('rejects invalid ports and proxy hop counts', () => {
    process.env = {
      NODE_ENV: 'test',
      POSTGRESQL_URL: 'postgresql://app:secret@localhost:5432/mercadozetta',
      PORT: '70000',
      TRUST_PROXY_HOPS: '11',
    };

    expect(() => getRuntimeConfig()).toThrow('PORT');
    process.env.PORT = '3333';
    expect(() => getRuntimeConfig()).toThrow('TRUST_PROXY_HOPS');

    process.env.TRUST_PROXY_HOPS = '-1';
    expect(() => getTrustProxyHops()).toThrow('TRUST_PROXY_HOPS');
  });

  it('validates optional PostgreSQL pool and timeout configuration', () => {
    process.env = {
      NODE_ENV: 'test',
      POSTGRESQL_URL: 'postgresql://app:secret@postgres:5432/mercadozetta',
      POSTGRES_POOL_MAX: '12',
      POSTGRES_CONNECTION_TIMEOUT_MS: '4000',
      POSTGRES_IDLE_TIMEOUT_MS: '20000',
      POSTGRES_STATEMENT_TIMEOUT_MS: '8000',
      POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS: '6000',
    };

    expect(getPostgresRuntimeConfig()).toEqual({
      connectionString: 'postgresql://app:secret@postgres:5432/mercadozetta',
      max: 12,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 20000,
      statementTimeoutMillis: 8000,
      idleInTransactionSessionTimeoutMillis: 6000,
      applicationName: 'mercadozetta-api',
    });
  });

  it('rejects unsafe PostgreSQL configuration', () => {
    process.env = { NODE_ENV: 'test' };
    expect(getPostgresRuntimeConfig()).toBeUndefined();

    process.env.POSTGRESQL_URL = 'mongodb://postgres/mercadozetta';
    expect(() => getPostgresRuntimeConfig()).toThrow('POSTGRESQL_URL');

    process.env.POSTGRESQL_URL = 'not-a-url';
    expect(() => getPostgresRuntimeConfig()).toThrow('POSTGRESQL_URL');

    process.env.POSTGRESQL_URL = 'postgresql://postgres/mercadozetta';
    process.env.POSTGRES_POOL_MAX = '0';
    expect(() => getPostgresRuntimeConfig()).toThrow('POSTGRES_POOL_MAX');

    process.env.POSTGRES_POOL_MAX = '10';
    process.env.POSTGRES_STATEMENT_TIMEOUT_MS = '99';
    expect(() => getPostgresRuntimeConfig()).toThrow(
      'POSTGRES_STATEMENT_TIMEOUT_MS',
    );
  });

  it('requires PostgreSQL for the application runtime', () => {
    process.env = {
      NODE_ENV: 'test',
      POSTGRESQL_URL: 'postgresql://app:secret@postgres:5432/mercadozetta',
    };
    expect(getRuntimeConfig()).toMatchObject({
      postgres: {
        connectionString: 'postgresql://app:secret@postgres:5432/mercadozetta',
      },
    });

    delete process.env.POSTGRESQL_URL;
    expect(() => getRuntimeConfig()).toThrow('POSTGRESQL_URL');
  });
});
