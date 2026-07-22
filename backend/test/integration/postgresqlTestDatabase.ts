import type { Pool } from 'pg';

const retainedTables = ['tenant_currencies', 'tenants'] as const;

const mutableTables = [
  'account_tokens',
  'audit_events',
  'cart_items',
  'carts',
  'delivery_addresses',
  'mutation_idempotency',
  'notifications',
  'order_items',
  'order_status_history',
  'orders',
  'pending_email_changes',
  'product_price_history',
  'products',
  'reviews',
  'sessions',
  'users',
  'watchlist_entries',
] as const;

const verifiedPools = new WeakSet<Pool>();

async function verifyTableManifest(pool: Pool) {
  if (verifiedPools.has(pool)) return;

  const result = await pool.query<{ tablename: string }>(`
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
    order by tablename
  `);
  const databaseTables = result.rows.map(({ tablename }) => tablename);
  const manifestTables = [...retainedTables, ...mutableTables].sort();
  const unexpectedTables = databaseTables.filter(
    (table) =>
      !manifestTables.includes(table as (typeof manifestTables)[number]),
  );
  const missingTables = manifestTables.filter(
    (table) => !databaseTables.includes(table),
  );

  if (unexpectedTables.length > 0 || missingTables.length > 0) {
    throw new Error(
      `PostgreSQL integration table manifest is out of date. ` +
        `Unexpected tables: ${unexpectedTables.join(', ') || 'none'}. ` +
        `Missing tables: ${missingTables.join(', ') || 'none'}.`,
    );
  }

  verifiedPools.add(pool);
}

export async function resetPostgresTestData(pool: Pool) {
  await verifyTableManifest(pool);
  await pool.query(
    `truncate table ${mutableTables.join(', ')} restart identity`,
  );
}
