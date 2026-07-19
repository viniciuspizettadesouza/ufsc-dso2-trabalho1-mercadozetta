import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accountTokens,
  auditEvents,
  cartItems,
  carts,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  pendingEmailChanges,
  productPriceHistory,
  reviews,
  sessions,
  tenantCurrencies,
  tenants,
  users,
  watchlistEntries,
  mutationIdempotency,
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
const accountSecurityMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0003_famous_miek.sql'),
  'utf8',
);
const accountManagementMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0004_melted_nekra.sql'),
  'utf8',
);
const checkoutIdempotencyMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0005_special_marauders.sql'),
  'utf8',
);
const mutationIdempotencyMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0006_yielding_captain_america.sql'),
  'utf8',
);
const monetaryModelMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0007_red_marvex.sql'),
  'utf8',
);
const tenantEurTransitionMigration = readFileSync(
  resolve(process.cwd(), 'drizzle/0008_tenant-eur-transition.sql'),
  'utf8',
);

describe('PostgreSQL schema contract', () => {
  const tables = [
    tenants,
    tenantCurrencies,
    users,
    pendingEmailChanges,
    accountTokens,
    products,
    carts,
    cartItems,
    watchlistEntries,
    orders,
    orderItems,
    productPriceHistory,
    orderStatusHistory,
    reviews,
    notifications,
    sessions,
    auditEvents,
    mutationIdempotency,
  ];

  it('exports the accepted relational tables', () => {
    expect(tables.map(getTableName)).toEqual([
      'tenants',
      'tenant_currencies',
      'users',
      'pending_email_changes',
      'account_tokens',
      'products',
      'carts',
      'cart_items',
      'watchlist_entries',
      'orders',
      'order_items',
      'product_price_history',
      'order_status_history',
      'reviews',
      'notifications',
      'sessions',
      'audit_events',
      'mutation_idempotency',
    ]);
    expect(migration.match(/CREATE TABLE/g)).toHaveLength(12);
    expect(auditEventMigration.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(accountSecurityMigration.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(accountManagementMigration.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(mutationIdempotencyMigration.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(monetaryModelMigration.match(/CREATE TABLE/g)).toHaveLength(1);
  });

  it('generates tenant-qualified integrity and inventory constraints', () => {
    const configs = tables.map(getTableConfig);
    expect(configs.flatMap((config) => config.foreignKeys)).toHaveLength(36);
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

  it('adds tenant-scoped single-use account tokens and verified-user state', () => {
    for (const expectedSql of [
      'account_tokens_tenant_user_fkey',
      'account_tokens_purpose_check',
      'account_tokens_email_version_check',
      'account_tokens_expiry_check',
      'account_tokens_lifecycle_check',
      'account_tokens_invalidation_reason_check',
      'account_tokens_active_key',
      'account_tokens_issuance_idx',
      'account_tokens_expiry_idx',
      'users_email_version_check',
      'user.email_verified',
      'user.password_reset',
    ])
      expect(accountSecurityMigration).toContain(expectedSql);

    expect(accountSecurityMigration).toContain(
      'SET "email_verified_at" = "created_at"',
    );
    expect(accountSecurityMigration).not.toMatch(
      /raw_token|password_hash|cookie|authorization|csrf/i,
    );
  });

  it('adds constrained pending email and account-management state', () => {
    for (const expectedSql of [
      'pending_email_changes_tenant_user_key',
      'pending_email_changes_tenant_email_key',
      'pending_email_changes_tenant_user_fkey',
      'pending_email_changes_email_version_check',
      'pending_email_changes_expiry_check',
      'pending_email_changes_expiry_idx',
      'deactivated_at',
      "'email_change'",
      "'password_change'",
      "'account_deactivated'",
      "'user.profile_updated'",
      "'user.password_changed'",
      "'user.email_change_requested'",
      "'user.email_changed'",
      "'user.deactivated'",
    ])
      expect(accountManagementMigration).toContain(expectedSql);

    expect(accountManagementMigration).not.toMatch(
      /raw_token|password_hash|cookie|authorization|csrf/i,
    );
  });

  it('backfills and constrains checkout idempotency keys compatibly', () => {
    for (const expectedSql of [
      'checkout_idempotency_key',
      'gen_random_uuid()',
      'SET DEFAULT',
      'SET NOT NULL',
      'orders_checkout_idempotency_key',
      'UNIQUE("tenant_id","buyer_id","checkout_idempotency_key")',
    ])
      expect(checkoutIdempotencyMigration).toContain(expectedSql);
  });

  it('adds scoped product and review mutation replay records', () => {
    for (const expectedSql of [
      'mutation_idempotency_pkey',
      'mutation_idempotency_tenant_actor_fkey',
      'mutation_idempotency_operation_check',
      'mutation_idempotency_request_hash_check',
      'mutation_idempotency_resource_idx',
      "'product.create'",
      "'review.upsert'",
    ])
      expect(mutationIdempotencyMigration).toContain(expectedSql);
    expect(mutationIdempotencyMigration).not.toMatch(
      /password|token|cookie|authorization|csrf/i,
    );
  });

  it('expands exact tenant money without pricing legacy commerce', () => {
    for (const expectedSql of [
      'currency_code',
      'currency_minor_unit',
      'unit_price_minor',
      'line_subtotal_minor',
      'subtotal_minor',
      'discount_minor',
      'shipping_minor',
      'total_minor',
      "DEFAULT 'legacy_unpriced'",
      'orders_pricing_state_check',
      'orders_monetary_shape_check',
      'orders_monetary_amounts_check',
      'order_items_monetary_shape_check',
      'products_unit_price_minor_check',
      'tenants_currency_code_check',
      'tenants_currency_minor_unit_check',
      'product_price_history_pkey',
      'product_price_history_tenant_product_fkey',
      'product_price_history_tenant_actor_fkey',
      'product_price_history_tenant_currency_fkey',
      'product_price_history_reject_update',
      'product_price_history_reject_delete',
      'orders_reject_monetary_snapshot_update',
      'order_items_reject_snapshot_update',
      'order_items_reject_snapshot_delete',
      '9000000000000000',
    ])
      expect(monetaryModelMigration).toContain(expectedSql);

    expect(monetaryModelMigration).not.toMatch(
      /UPDATE\s+"?(?:products|orders|order_items)"?\s+SET\s+"?(?:unit_price|subtotal|total)/i,
    );
    expect(monetaryModelMigration).not.toMatch(
      /\b(?:real|double precision|money)\b/i,
    );

    expect(
      monetaryModelMigration.indexOf('tenants_id_currency_key'),
    ).toBeLessThan(
      monetaryModelMigration.indexOf(
        'product_price_history_tenant_currency_fkey',
      ),
    );
    expect(
      monetaryModelMigration.indexOf('orders_tenant_id_pricing_state_key'),
    ).toBeLessThan(
      monetaryModelMigration.indexOf(
        'ADD CONSTRAINT "order_items_tenant_order_fkey"',
      ),
    );
  });

  it('preserves tenant USD history while deliberately moving CampusMarket to EUR', () => {
    for (const expectedSql of [
      'tenant_currencies_pkey',
      'tenant_currencies_tenant_id_tenants_id_fk',
      'orders_tenant_currency_fkey',
      'product_price_history_tenant_currency_fkey',
      "('campus-market', 'EUR', 2)",
      '1899::bigint',
      '5490::bigint',
    ])
      expect(tenantEurTransitionMigration).toContain(expectedSql);

    expect(tenantEurTransitionMigration).toContain(
      'SELECT "id", "currency_code", "currency_minor_unit"',
    );
    expect(tenantEurTransitionMigration).toContain(
      "WHEN \"status\" IN ('active', 'sold_out') THEN 'paused'",
    );
    expect(tenantEurTransitionMigration).toContain(
      'INSERT INTO "product_price_history"',
    );
    expect(tenantEurTransitionMigration).not.toMatch(
      /UPDATE\s+"(?:orders|order_items|product_price_history)"/i,
    );
    expect(tenantEurTransitionMigration).not.toContain(
      "('mercadozetta', 'EUR', 2)",
    );
    expect(tenantEurTransitionMigration).toContain(
      'WHERE "id" = \'campus-market\'',
    );
  });
});
