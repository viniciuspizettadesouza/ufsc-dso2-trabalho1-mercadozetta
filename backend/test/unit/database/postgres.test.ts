import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import type { PostgresRuntimeConfig } from '@/config/runtime';
import {
  closePostgres,
  getPostgresDatabase,
  getPostgresReadiness,
  initializePostgres,
  PostgresConnection,
} from '@/database/postgres';

const config: PostgresRuntimeConfig = {
  connectionString: 'postgresql://app:secret@postgres:5432/mercadozetta',
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statementTimeoutMillis: 10000,
  idleInTransactionSessionTimeoutMillis: 10000,
  applicationName: 'mercadozetta-api',
};

function poolDouble() {
  return {
    query: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  } as unknown as Pool;
}

afterEach(async () => {
  await closePostgres();
});

describe('PostgreSQL connection', () => {
  it('is disabled until the optional transition connection is initialized', async () => {
    await expect(getPostgresReadiness()).resolves.toBe('disabled');
    expect(() => getPostgresDatabase()).toThrow('not initialized');
  });

  it('checks connectivity, reports failures, and closes its pool', async () => {
    const pool = poolDouble();
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
      .mockRejectedValueOnce(new Error('database unavailable'));
    const connection = new PostgresConnection(config, pool);

    expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function));
    await connection.connect();
    await expect(connection.readiness()).resolves.toBe('connected');
    await expect(connection.readiness()).resolves.toBe('disconnected');
    await connection.close();

    expect(pool.query).toHaveBeenCalledWith('select 1');
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('marks an idle-pool error unhealthy until the next successful probe', async () => {
    const pool = poolDouble();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const connection = new PostgresConnection(config, pool);
    await connection.connect();

    const errorHandler = vi.mocked(pool.on).mock.calls[0][1] as () => void;
    errorHandler();

    await expect(connection.readiness()).resolves.toBe('connected');
  });

  it('initializes and exposes one global database connection', async () => {
    const pool = poolDouble();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

    const database = await initializePostgres(config, pool);

    expect(getPostgresDatabase()).toBe(database);
    await expect(getPostgresReadiness()).resolves.toBe('connected');
    await expect(initializePostgres(config, pool)).rejects.toThrow(
      'already initialized',
    );

    await closePostgres();
    expect(pool.end).toHaveBeenCalledOnce();
    await expect(getPostgresReadiness()).resolves.toBe('disabled');
  });
});
