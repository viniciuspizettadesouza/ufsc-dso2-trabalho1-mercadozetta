import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '@/database/schema';
import {
  accountTokens,
  auditEvents,
  cartItems,
  carts,
  notifications,
  pendingEmailChanges,
  products,
  sessions,
  users,
  watchlistEntries,
} from '@/database/schema';
import { PostgresCartRepository } from '@/repositories/postgres/checkoutRepositories';
import { PostgresDataCleanupRepository } from '@/repositories/postgres/dataCleanupRepository';
import { runDataCleanup } from '@/services/dataCleanupService';

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString)
  throw new Error('POSTGRESQL_URL is required for cleanup integration tests');

const pool = new Pool({ connectionString, max: 4 });
const db = drizzle({ client: pool, schema });
const cleanupRepository = new PostgresDataCleanupRepository(db);
const tenantId = 'mercadozetta';
const userId = '10000000-0000-4000-8000-000000000001';
const productId = '20000000-0000-4000-8000-000000000001';
const now = new Date('2026-08-01T00:00:00.000Z');

async function seedOwnerAndProduct() {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  await db.insert(users).values({
    id: userId,
    tenantId,
    email: 'cleanup-user@example.invalid',
    passwordHash: 'not-a-real-credential',
    emailVerifiedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  await db.insert(products).values({
    id: productId,
    tenantId,
    sellerId: userId,
    name: 'cleanup product',
    inventory: 10,
    imageUrl: '/cleanup.png',
    createdAt,
    updatedAt: createdAt,
  });
}

describe('PostgreSQL data cleanup', () => {
  beforeAll(async () => {
    await pool.query('select 1');
  });

  beforeEach(async () => {
    await pool.query(`truncate table
      audit_events, notifications, reviews, watchlist_entries, sessions,
      pending_email_changes, account_tokens, order_status_history, order_items,
      orders, cart_items, carts, products, users restart identity cascade`);
    await seedOwnerAndProduct();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('deletes only eligible disposable rows and cascades abandoned cart items', async () => {
    const eligibleId = randomUUID();
    const retainedId = randomUUID();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    await db.insert(sessions).values([
      {
        id: eligibleId,
        tenantId,
        userId,
        familyId: randomUUID(),
        tokenVersion: 0,
        refreshTokenHash: 'eligible-session',
        rotationCounter: 0,
        lastUsedAt: createdAt,
        expiresAt: new Date('2026-07-20T00:00:00.000Z'),
        absoluteExpiresAt: new Date('2026-07-21T00:00:00.000Z'),
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: retainedId,
        tenantId,
        userId,
        familyId: randomUUID(),
        tokenVersion: 0,
        refreshTokenHash: 'retained-session',
        rotationCounter: 0,
        lastUsedAt: createdAt,
        expiresAt: new Date('2026-07-30T00:00:00.000Z'),
        absoluteExpiresAt: new Date('2026-07-31T00:00:00.000Z'),
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    await db.insert(accountTokens).values([
      {
        id: randomUUID(),
        tenantId,
        userId,
        purpose: 'password_reset',
        tokenHash: 'a'.repeat(64),
        tokenHashSecretVersion: 'current',
        expiresAt: new Date('2026-08-02T00:00:00.000Z'),
        consumedAt: new Date('2026-07-20T00:00:00.000Z'),
        createdAt,
      },
      {
        id: randomUUID(),
        tenantId,
        userId,
        purpose: 'email_verification',
        tokenHash: 'b'.repeat(64),
        tokenHashSecretVersion: 'current',
        emailVersion: 0,
        expiresAt: new Date('2026-08-02T00:00:00.000Z'),
        createdAt,
      },
    ]);
    await db.insert(pendingEmailChanges).values([
      {
        id: randomUUID(),
        tenantId,
        userId,
        email: 'expired-pending@example.invalid',
        emailVersion: 0,
        expiresAt: new Date('2026-07-30T00:00:00.000Z'),
        createdAt,
      },
    ]);
    await db.insert(notifications).values([
      {
        id: randomUUID(),
        tenantId,
        userId,
        message: 'eligible read',
        isRead: true,
        createdAt,
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: randomUUID(),
        tenantId,
        userId,
        message: 'retained read',
        isRead: true,
        createdAt,
        updatedAt: new Date('2026-07-10T00:00:00.000Z'),
      },
      {
        id: randomUUID(),
        tenantId,
        userId,
        message: 'eligible unread',
        isRead: false,
        createdAt,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: randomUUID(),
        tenantId,
        userId,
        message: 'retained unread',
        isRead: false,
        createdAt,
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);
    const oldCartId = randomUUID();
    const freshCartId = randomUUID();
    await db.insert(users).values({
      id: '10000000-0000-4000-8000-000000000002',
      tenantId,
      email: 'cleanup-user-two@example.invalid',
      passwordHash: 'not-a-real-credential',
      emailVerifiedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
    await db.insert(carts).values([
      {
        id: oldCartId,
        tenantId,
        buyerId: userId,
        createdAt,
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: freshCartId,
        tenantId,
        buyerId: '10000000-0000-4000-8000-000000000002',
        createdAt,
        updatedAt: new Date('2026-07-15T00:00:00.000Z'),
      },
    ]);
    await db.insert(cartItems).values({
      tenantId,
      cartId: oldCartId,
      productId,
      quantity: 1,
    });
    await db.insert(watchlistEntries).values({
      id: randomUUID(),
      tenantId,
      userId,
      productId,
      createdAt,
      updatedAt: createdAt,
    });
    await db.insert(auditEvents).values({
      id: randomUUID(),
      tenantId,
      eventType: 'session.created',
      actorId: userId,
      resourceType: 'session',
      resourceId: eligibleId,
      occurredAt: createdAt,
    });

    const result = await runDataCleanup(
      cleanupRepository,
      { batchSize: 1, maxBatchesPerTarget: 10, dryRun: false },
      now,
    );

    expect(result.targets.sessions.rows).toBe(1);
    expect(result.targets.readNotifications.rows).toBe(1);
    expect(result.targets.unreadNotifications.rows).toBe(1);
    expect(result.targets.carts.rows).toBe(1);
    await expect(db.select().from(sessions)).resolves.toHaveLength(1);
    await expect(db.select().from(accountTokens)).resolves.toHaveLength(1);
    await expect(db.select().from(pendingEmailChanges)).resolves.toHaveLength(
      0,
    );
    await expect(db.select().from(notifications)).resolves.toHaveLength(2);
    await expect(db.select().from(carts)).resolves.toHaveLength(1);
    await expect(db.select().from(cartItems)).resolves.toHaveLength(0);
    await expect(db.select().from(watchlistEntries)).resolves.toHaveLength(1);
    await expect(db.select().from(auditEvents)).resolves.toHaveLength(1);
  });

  it('refreshes cart activity for item set and removal', async () => {
    const repository = new PostgresCartRepository(db);
    const old = new Date('2026-01-01T00:00:00.000Z');
    await repository.setItem(tenantId, userId, productId, 2);
    await db.update(carts).set({ updatedAt: old });

    await repository.setItem(tenantId, userId, productId, 3);
    let [cart] = await db.select().from(carts);
    expect(cart.updatedAt.getTime()).toBeGreaterThan(old.getTime());

    await db.update(carts).set({ updatedAt: old });
    await repository.removeItem(tenantId, userId, productId);
    [cart] = await db.select().from(carts);
    expect(cart.updatedAt.getTime()).toBeGreaterThan(old.getTime());
  });

  it('previews without mutation and lets concurrent batches share work', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    await db.insert(notifications).values(
      Array.from({ length: 4 }, (_, index) => ({
        id: randomUUID(),
        tenantId,
        userId,
        message: `old read ${index}`,
        isRead: true,
        createdAt,
        updatedAt: createdAt,
      })),
    );

    const dryRun = await runDataCleanup(
      cleanupRepository,
      { batchSize: 2, maxBatchesPerTarget: 2, dryRun: true },
      now,
    );
    expect(dryRun.targets.readNotifications).toEqual({
      rows: 2,
      batches: 0,
      limitReached: true,
    });
    await expect(db.select().from(notifications)).resolves.toHaveLength(4);

    const cutoff = new Date('2026-07-02T00:00:00.000Z');
    const counts = await Promise.all([
      cleanupRepository.deleteEligible('readNotifications', cutoff, 2),
      cleanupRepository.deleteEligible('readNotifications', cutoff, 2),
    ]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(4);
    await expect(
      db.select().from(notifications).where(eq(notifications.isRead, true)),
    ).resolves.toHaveLength(0);
  });
});
