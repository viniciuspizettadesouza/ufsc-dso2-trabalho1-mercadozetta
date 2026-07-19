import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const maximumMoneyMinor = 9_000_000_000_000_000n;
const maximumMoneyMinorSql = sql.raw(maximumMoneyMinor.toString());

const lifecycleTimestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const tenants = pgTable(
  'tenants',
  {
    id: text().primaryKey(),
    currencyCode: char('currency_code', { length: 3 }).default('USD').notNull(),
    currencyMinorUnit: smallint('currency_minor_unit').default(2).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('tenants_id_currency_key').on(
      table.id,
      table.currencyCode,
      table.currencyMinorUnit,
    ),
    check(
      'tenants_currency_code_check',
      sql`${table.currencyCode} ~ '^[A-Z]{3}$'`,
    ),
    check(
      'tenants_currency_minor_unit_check',
      sql`${table.currencyMinorUnit} between 0 and 4`,
    ),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    tokenVersion: integer('token_version').default(0).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    emailVersion: integer('email_version').default(0).notNull(),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    username: text(),
    telephone: text(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('users_tenant_id_id_key').on(table.tenantId, table.id),
    uniqueIndex('users_tenant_email_key').on(
      table.tenantId,
      sql`lower(${table.email})`,
    ),
    check('users_token_version_check', sql`${table.tokenVersion} >= 0`),
    check('users_email_version_check', sql`${table.emailVersion} >= 0`),
  ],
);

export const pendingEmailChanges = pgTable(
  'pending_email_changes',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    userId: uuid('user_id').notNull(),
    email: text().notNull(),
    emailVersion: integer('email_version').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('pending_email_changes_tenant_id_id_key').on(
      table.tenantId,
      table.id,
    ),
    unique('pending_email_changes_tenant_user_key').on(
      table.tenantId,
      table.userId,
    ),
    uniqueIndex('pending_email_changes_tenant_email_key').on(
      table.tenantId,
      sql`lower(${table.email})`,
    ),
    foreignKey({
      name: 'pending_email_changes_tenant_user_fkey',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check(
      'pending_email_changes_email_version_check',
      sql`${table.emailVersion} >= 0`,
    ),
    check(
      'pending_email_changes_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    index('pending_email_changes_expiry_idx').on(table.expiresAt, table.id),
  ],
);

export const accountTokens = pgTable(
  'account_tokens',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    userId: uuid('user_id').notNull(),
    purpose: varchar({ length: 32 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    tokenHashSecretVersion: varchar('token_hash_secret_version', {
      length: 32,
    }).notNull(),
    emailVersion: integer('email_version'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
    invalidationReason: varchar('invalidation_reason', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('account_tokens_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      name: 'account_tokens_tenant_user_fkey',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check(
      'account_tokens_purpose_check',
      sql`${table.purpose} in ('email_verification', 'password_reset', 'email_change')`,
    ),
    check(
      'account_tokens_email_version_check',
      sql`(${table.purpose} in ('email_verification', 'email_change') and ${table.emailVersion} is not null and ${table.emailVersion} >= 0)
        or (${table.purpose} = 'password_reset' and ${table.emailVersion} is null)`,
    ),
    check(
      'account_tokens_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      'account_tokens_lifecycle_check',
      sql`not (${table.consumedAt} is not null and ${table.invalidatedAt} is not null)
        and (${table.invalidatedAt} is null) = (${table.invalidationReason} is null)
        and (${table.consumedAt} is null or ${table.consumedAt} >= ${table.createdAt})
        and (${table.invalidatedAt} is null or ${table.invalidatedAt} >= ${table.createdAt})`,
    ),
    check(
      'account_tokens_invalidation_reason_check',
      sql`${table.invalidationReason} is null or ${table.invalidationReason} in ('replaced', 'password_reset', 'password_change', 'email_changed', 'account_deactivated')`,
    ),
    uniqueIndex('account_tokens_active_key')
      .on(table.tenantId, table.userId, table.purpose)
      .where(
        sql`${table.consumedAt} is null and ${table.invalidatedAt} is null`,
      ),
    index('account_tokens_issuance_idx').on(
      table.tenantId,
      table.userId,
      table.purpose,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('account_tokens_expiry_idx').on(table.expiresAt, table.id),
  ],
);

export const products = pgTable(
  'products',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    sellerId: uuid('seller_id').notNull(),
    name: text().notNull(),
    description: text(),
    category: text().default('general').notNull(),
    subcategory: text().default('').notNull(),
    inventory: integer().notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }),
    imageUrl: text('image_url').notNull(),
    status: text().default('active').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('products_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      name: 'products_tenant_seller_fkey',
      columns: [table.tenantId, table.sellerId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('products_inventory_check', sql`${table.inventory} >= 0`),
    check(
      'products_unit_price_minor_check',
      sql`${table.unitPriceMinor} is null or (${table.unitPriceMinor} >= 0 and ${table.unitPriceMinor} <= ${maximumMoneyMinorSql})`,
    ),
    check(
      'products_status_check',
      sql`${table.status} in ('draft', 'active', 'paused', 'sold_out', 'archived')`,
    ),
    index('products_catalog_idx').on(
      table.tenantId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('products_seller_idx').on(
      table.tenantId,
      table.sellerId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('products_category_idx').on(
      table.tenantId,
      table.category,
      table.subcategory,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('products_name_idx').on(
      table.tenantId,
      table.name,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('products_inventory_idx').on(
      table.tenantId,
      table.inventory.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const carts = pgTable(
  'carts',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    buyerId: uuid('buyer_id').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('carts_tenant_id_id_key').on(table.tenantId, table.id),
    unique('carts_tenant_buyer_key').on(table.tenantId, table.buyerId),
    foreignKey({
      name: 'carts_tenant_buyer_fkey',
      columns: [table.tenantId, table.buyerId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
  ],
);

export const cartItems = pgTable(
  'cart_items',
  {
    tenantId: text('tenant_id').notNull(),
    cartId: uuid('cart_id').notNull(),
    productId: uuid('product_id').notNull(),
    quantity: integer().notNull(),
  },
  (table) => [
    primaryKey({
      name: 'cart_items_pkey',
      columns: [table.tenantId, table.cartId, table.productId],
    }),
    foreignKey({
      name: 'cart_items_tenant_cart_fkey',
      columns: [table.tenantId, table.cartId],
      foreignColumns: [carts.tenantId, carts.id],
    })
      .onDelete('cascade')
      .onUpdate('restrict'),
    foreignKey({
      name: 'cart_items_tenant_product_fkey',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('cart_items_quantity_check', sql`${table.quantity} > 0`),
  ],
);

export const watchlistEntries = pgTable(
  'watchlist_entries',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    userId: uuid('user_id').notNull(),
    productId: uuid('product_id').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('watchlist_entries_tenant_id_id_key').on(table.tenantId, table.id),
    unique('watchlist_entries_tenant_user_product_key').on(
      table.tenantId,
      table.userId,
      table.productId,
    ),
    foreignKey({
      name: 'watchlist_entries_tenant_user_fkey',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'watchlist_entries_tenant_product_fkey',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    index('watchlist_entries_user_idx').on(
      table.tenantId,
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    buyerId: uuid('buyer_id').notNull(),
    checkoutIdempotencyKey: uuid('checkout_idempotency_key')
      .defaultRandom()
      .notNull(),
    pricingState: varchar('pricing_state', { length: 24 })
      .default('legacy_unpriced')
      .notNull(),
    currencyCode: char('currency_code', { length: 3 }),
    currencyMinorUnit: smallint('currency_minor_unit'),
    subtotalMinor: bigint('subtotal_minor', { mode: 'bigint' }),
    discountMinor: bigint('discount_minor', { mode: 'bigint' }),
    shippingMinor: bigint('shipping_minor', { mode: 'bigint' }),
    totalMinor: bigint('total_minor', { mode: 'bigint' }),
    status: text().default('placed').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('orders_tenant_id_id_key').on(table.tenantId, table.id),
    unique('orders_tenant_id_pricing_state_key').on(
      table.tenantId,
      table.id,
      table.pricingState,
    ),
    unique('orders_checkout_idempotency_key').on(
      table.tenantId,
      table.buyerId,
      table.checkoutIdempotencyKey,
    ),
    foreignKey({
      name: 'orders_tenant_buyer_fkey',
      columns: [table.tenantId, table.buyerId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'orders_tenant_currency_fkey',
      columns: [table.tenantId, table.currencyCode, table.currencyMinorUnit],
      foreignColumns: [
        tenants.id,
        tenants.currencyCode,
        tenants.currencyMinorUnit,
      ],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check(
      'orders_pricing_state_check',
      sql`${table.pricingState} in ('legacy_unpriced', 'priced')`,
    ),
    check(
      'orders_monetary_shape_check',
      sql`(${table.pricingState} = 'legacy_unpriced'
        and ${table.currencyCode} is null
        and ${table.currencyMinorUnit} is null
        and ${table.subtotalMinor} is null
        and ${table.discountMinor} is null
        and ${table.shippingMinor} is null
        and ${table.totalMinor} is null)
        or (${table.pricingState} = 'priced'
          and ${table.currencyCode} is not null
          and ${table.currencyMinorUnit} is not null
          and ${table.subtotalMinor} is not null
          and ${table.discountMinor} is not null
          and ${table.shippingMinor} is not null
          and ${table.totalMinor} is not null)`,
    ),
    check(
      'orders_monetary_amounts_check',
      sql`${table.pricingState} = 'legacy_unpriced' or (
        ${table.subtotalMinor} between 0 and ${maximumMoneyMinorSql}
        and ${table.discountMinor} between 0 and ${table.subtotalMinor}
        and ${table.shippingMinor} between 0 and ${maximumMoneyMinorSql}
        and ${table.totalMinor} between 0 and ${maximumMoneyMinorSql}
        and ${table.totalMinor} = ${table.subtotalMinor} - ${table.discountMinor} + ${table.shippingMinor}
      )`,
    ),
    check(
      'orders_status_check',
      sql`${table.status} in ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled')`,
    ),
    index('orders_buyer_idx').on(
      table.tenantId,
      table.buyerId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id').notNull(),
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id').notNull(),
    sellerId: uuid('seller_id').notNull(),
    productName: text('product_name').notNull(),
    quantity: integer().notNull(),
    pricingState: varchar('pricing_state', { length: 24 })
      .default('legacy_unpriced')
      .notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }),
    lineSubtotalMinor: bigint('line_subtotal_minor', { mode: 'bigint' }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('order_items_tenant_id_id_key').on(table.tenantId, table.id),
    unique('order_items_order_product_key').on(
      table.tenantId,
      table.orderId,
      table.productId,
    ),
    foreignKey({
      name: 'order_items_tenant_order_fkey',
      columns: [table.tenantId, table.orderId, table.pricingState],
      foreignColumns: [orders.tenantId, orders.id, orders.pricingState],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'order_items_tenant_product_fkey',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'order_items_tenant_seller_fkey',
      columns: [table.tenantId, table.sellerId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('order_items_quantity_check', sql`${table.quantity} > 0`),
    check(
      'order_items_monetary_shape_check',
      sql`(${table.pricingState} = 'legacy_unpriced'
        and ${table.unitPriceMinor} is null
        and ${table.lineSubtotalMinor} is null)
        or (${table.pricingState} = 'priced'
          and ${table.unitPriceMinor} between 0 and ${maximumMoneyMinorSql}
          and ${table.lineSubtotalMinor} between 0 and ${maximumMoneyMinorSql}
          and ${table.lineSubtotalMinor} = ${table.unitPriceMinor} * ${table.quantity})`,
    ),
    index('order_items_seller_idx').on(
      table.tenantId,
      table.sellerId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('order_items_order_idx').on(table.tenantId, table.orderId),
  ],
);

export const productPriceHistory = pgTable(
  'product_price_history',
  {
    tenantId: text('tenant_id').notNull(),
    productId: uuid('product_id').notNull(),
    sequence: integer().notNull(),
    currencyCode: char('currency_code', { length: 3 }).notNull(),
    currencyMinorUnit: smallint('currency_minor_unit').notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }).notNull(),
    actorId: uuid('actor_id').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'product_price_history_pkey',
      columns: [table.tenantId, table.productId, table.sequence],
    }),
    foreignKey({
      name: 'product_price_history_tenant_product_fkey',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'product_price_history_tenant_actor_fkey',
      columns: [table.tenantId, table.actorId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'product_price_history_tenant_currency_fkey',
      columns: [table.tenantId, table.currencyCode, table.currencyMinorUnit],
      foreignColumns: [
        tenants.id,
        tenants.currencyCode,
        tenants.currencyMinorUnit,
      ],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('product_price_history_sequence_check', sql`${table.sequence} > 0`),
    check(
      'product_price_history_unit_price_minor_check',
      sql`${table.unitPriceMinor} between 0 and ${maximumMoneyMinorSql}`,
    ),
    index('product_price_history_changed_idx').on(
      table.tenantId,
      table.productId,
      table.changedAt.desc(),
      table.sequence.desc(),
    ),
  ],
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    tenantId: text('tenant_id').notNull(),
    orderId: uuid('order_id').notNull(),
    sequence: integer().notNull(),
    status: text().notNull(),
    actorId: uuid('actor_id').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'order_status_history_pkey',
      columns: [table.tenantId, table.orderId, table.sequence],
    }),
    foreignKey({
      name: 'order_status_history_tenant_order_fkey',
      columns: [table.tenantId, table.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'order_status_history_tenant_actor_fkey',
      columns: [table.tenantId, table.actorId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('order_status_history_sequence_check', sql`${table.sequence} > 0`),
    check(
      'order_status_history_status_check',
      sql`${table.status} in ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled')`,
    ),
  ],
);

export const mutationIdempotency = pgTable(
  'mutation_idempotency',
  {
    tenantId: text('tenant_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    operation: varchar({ length: 64 }).notNull(),
    key: uuid().notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    resourceId: uuid('resource_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'mutation_idempotency_pkey',
      columns: [table.tenantId, table.actorId, table.operation, table.key],
    }),
    foreignKey({
      name: 'mutation_idempotency_tenant_actor_fkey',
      columns: [table.tenantId, table.actorId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check(
      'mutation_idempotency_operation_check',
      sql`${table.operation} in ('product.create', 'review.upsert')`,
    ),
    check(
      'mutation_idempotency_request_hash_check',
      sql`length(${table.requestHash}) = 64`,
    ),
    index('mutation_idempotency_resource_idx').on(
      table.tenantId,
      table.operation,
      table.resourceId,
    ),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    productId: uuid('product_id').notNull(),
    authorId: uuid('author_id').notNull(),
    rating: smallint().notNull(),
    comment: text().notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('reviews_tenant_id_id_key').on(table.tenantId, table.id),
    unique('reviews_tenant_product_author_key').on(
      table.tenantId,
      table.productId,
      table.authorId,
    ),
    foreignKey({
      name: 'reviews_tenant_product_fkey',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'reviews_tenant_author_fkey',
      columns: [table.tenantId, table.authorId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('reviews_rating_check', sql`${table.rating} between 1 and 5`),
    check(
      'reviews_comment_length_check',
      sql`length(${table.comment}) <= 1000`,
    ),
    index('reviews_product_idx').on(
      table.tenantId,
      table.productId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    userId: uuid('user_id').notNull(),
    message: text().notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('notifications_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      name: 'notifications_tenant_user_fkey',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    index('notifications_user_idx').on(
      table.tenantId,
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('notifications_unread_idx')
      .on(table.tenantId, table.userId)
      .where(sql`${table.isRead} = false`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    userId: uuid('user_id').notNull(),
    familyId: uuid('family_id').notNull(),
    tokenVersion: integer('token_version').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    refreshTokenSecretVersion: varchar('refresh_token_secret_version', {
      length: 32,
    }),
    previousRefreshTokenHash: text('previous_refresh_token_hash'),
    previousRefreshTokenSecretVersion: varchar(
      'previous_refresh_token_secret_version',
      { length: 32 },
    ),
    rotationCounter: integer('rotation_counter').default(0).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
    userAgentLabel: varchar('user_agent_label', { length: 120 }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('sessions_tenant_id_id_key').on(table.tenantId, table.id),
    unique('sessions_tenant_family_key').on(table.tenantId, table.familyId),
    foreignKey({
      name: 'sessions_tenant_user_fkey',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('sessions_token_version_check', sql`${table.tokenVersion} >= 0`),
    check(
      'sessions_rotation_counter_check',
      sql`${table.rotationCounter} >= 0`,
    ),
    check(
      'sessions_refresh_secret_version_check',
      sql`${table.refreshTokenSecretVersion} is null
        or ${table.refreshTokenSecretVersion} ~ '^[A-Za-z0-9_-]{1,32}$'`,
    ),
    check(
      'sessions_previous_secret_version_check',
      sql`${table.previousRefreshTokenSecretVersion} is null
        or ${table.previousRefreshTokenSecretVersion} ~ '^[A-Za-z0-9_-]{1,32}$'`,
    ),
    check(
      'sessions_previous_hash_version_check',
      sql`(${table.previousRefreshTokenHash} is null) = (${table.previousRefreshTokenSecretVersion} is null)`,
    ),
    check(
      'sessions_revocation_check',
      sql`(${table.revokedAt} is null) = (${table.revokeReason} is null)`,
    ),
    check(
      'sessions_expiry_check',
      sql`${table.expiresAt} <= ${table.absoluteExpiresAt}
        and ${table.expiresAt} > ${table.createdAt}
        and ${table.absoluteExpiresAt} > ${table.createdAt}`,
    ),
    index('sessions_user_idx').on(
      table.tenantId,
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('sessions_expiry_idx').on(table.expiresAt, table.id),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid().primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    actorId: uuid('actor_id'),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    metadata: jsonb().$type<Record<string, string | number | boolean | null>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: 'audit_events_tenant_actor_fkey',
      columns: [table.tenantId, table.actorId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check(
      'audit_events_event_type_check',
      sql`${table.eventType} in ('session.created', 'session.rotated', 'session.revoked', 'session.reuse_detected', 'inventory.set', 'inventory.decremented', 'order.placed', 'order.status_changed', 'user.email_verified', 'user.password_reset', 'user.profile_updated', 'user.password_changed', 'user.email_change_requested', 'user.email_changed', 'user.deactivated')`,
    ),
    check(
      'audit_events_resource_type_check',
      sql`${table.resourceType} in ('session', 'user', 'product', 'order')`,
    ),
    index('audit_events_tenant_time_idx').on(
      table.tenantId,
      table.occurredAt.desc(),
      table.id.desc(),
    ),
    index('audit_events_resource_idx').on(
      table.tenantId,
      table.resourceType,
      table.resourceId,
      table.occurredAt.desc(),
    ),
    index('audit_events_actor_idx').on(
      table.tenantId,
      table.actorId,
      table.occurredAt.desc(),
    ),
  ],
);
