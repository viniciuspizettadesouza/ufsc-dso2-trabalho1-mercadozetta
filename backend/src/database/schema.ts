import { sql } from 'drizzle-orm';
import {
  boolean,
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

const lifecycleTimestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const tenants = pgTable('tenants', {
  id: text().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
    status: text().default('placed').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    unique('orders_tenant_id_id_key').on(table.tenantId, table.id),
    foreignKey({
      name: 'orders_tenant_buyer_fkey',
      columns: [table.tenantId, table.buyerId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
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
      columns: [table.tenantId, table.orderId],
      foreignColumns: [orders.tenantId, orders.id],
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
    index('order_items_seller_idx').on(
      table.tenantId,
      table.sellerId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('order_items_order_idx').on(table.tenantId, table.orderId),
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
      sql`${table.eventType} in ('session.created', 'session.rotated', 'session.revoked', 'session.reuse_detected', 'inventory.set', 'inventory.decremented', 'order.placed', 'order.status_changed')`,
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
