import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
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
  ];

  it('exports the twelve accepted relational tables', () => {
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
    ]);
    expect(migration.match(/CREATE TABLE/g)).toHaveLength(12);
  });

  it('generates tenant-qualified integrity and inventory constraints', () => {
    const configs = tables.map(getTableConfig);
    expect(configs.flatMap((config) => config.foreignKeys)).toHaveLength(24);
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
});
