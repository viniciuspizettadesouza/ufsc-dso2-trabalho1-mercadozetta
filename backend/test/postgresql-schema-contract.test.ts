import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  auditEvents,
  cartItems,
  carts,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  reviews,
  sessions,
  tenants,
  users,
  watchlistEntries,
} from '@/database/schema';

const migration = readFileSync(
  resolve(process.cwd(), 'drizzle/0000_initial_postgresql.sql'),
  'utf8',
);
const catalogIndexMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0001_next_expediter.sql'),
  'utf8',
);
const auditEventMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0002_easy_jasper_sitwell.sql'),
  'utf8',
);

describe('PostgreSQL schema contract', () => {
  const tables = [
    tenants,
    users,
    products,
    carts,
    cartItems,
    watchlistEntries,
    orders,
    orderItems,
    orderStatusHistory,
    reviews,
    notifications,
    sessions,
    auditEvents,
  ];

  it('exports the accepted relational tables', () => {
    expect(tables.map(getTableName)).toEqual([
      'tenants',
      'users',
      'products',
      'carts',
      'cart_items',
      'watchlist_entries',
      'orders',
      'order_items',
      'order_status_history',
      'reviews',
      'notifications',
      'sessions',
      'audit_events',
    ]);
    expect(migration.match(/CREATE TABLE/g)).toHaveLength(12);
    expect(auditEventMigration.match(/CREATE TABLE/g)).toHaveLength(1);
  });

  it('generates tenant-qualified integrity and inventory constraints', () => {
    const configs = tables.map(getTableConfig);
    expect(configs.flatMap((config) => config.foreignKeys)).toHaveLength(26);
    expect(configs.flatMap((config) => config.checks).length).toBeGreaterThan(
      10,
    );

    for (const expectedSql of [
      'products_inventory_check',
      'cart_items_quantity_check',
      'order_items_quantity_check',
      'reviews_rating_check',
      'sessions_expiry_check',
      'sessions_previous_hash_version_check',
      'products_tenant_seller_fkey',
      'cart_items_tenant_product_fkey',
      'order_items_tenant_order_fkey',
      'sessions_tenant_user_fkey',
      'notifications_unread_idx',
      'users_tenant_email_key',
    ]) {
      expect(migration).toContain(expectedSql);
    }

    expect(migration.match(/ON DELETE cascade/g)).toHaveLength(1);
    expect(migration).not.toMatch(/ObjectId|\bserial\b/i);
  });

  it('seeds only the configured tenant integrity anchors', () => {
    expect(migration).toContain("VALUES ('mercadozetta'), ('campus-market')");
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it('adds reviewed indexes for bounded catalog sort orders', () => {
    expect(catalogIndexMigration).toContain('products_name_idx');
    expect(catalogIndexMigration).toContain('products_inventory_idx');
    expect(catalogIndexMigration).toContain('"tenant_id"');
  });

  it('creates constrained append-only audit events with query indexes', () => {
    for (const expectedSql of [
      'audit_events_event_type_check',
      'audit_events_resource_type_check',
      'audit_events_tenant_actor_fkey',
      'audit_events_tenant_time_idx',
      'audit_events_resource_idx',
      'audit_events_actor_idx',
      'audit_events_reject_update',
      'audit_events_reject_delete',
    ])
      expect(auditEventMigration).toContain(expectedSql);

    expect(auditEventMigration).not.toMatch(
      /password|token_hash|cookie|authorization|csrf/i,
    );
  });
});
