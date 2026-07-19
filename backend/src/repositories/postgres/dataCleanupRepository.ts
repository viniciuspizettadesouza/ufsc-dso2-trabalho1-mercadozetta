import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import {
  accountTokens,
  carts,
  notifications,
  pendingEmailChanges,
  sessions,
} from '@/database/schema';
import type {
  CleanupPreview,
  CleanupTarget,
  DataCleanupRepository,
} from '@/repositories/dataCleanupRepository';

type IdRow = { id: string };

function preview(rows: IdRow[], limit: number): CleanupPreview {
  return {
    count: Math.min(rows.length, limit),
    limitReached: rows.length > limit,
  };
}

export class PostgresDataCleanupRepository implements DataCleanupRepository {
  constructor(private readonly db: Database) {}

  async deleteEligible(target: CleanupTarget, cutoff: Date, limit: number) {
    switch (target) {
      case 'sessions': {
        const eligible = or(
          lte(sessions.expiresAt, cutoff),
          lte(sessions.revokedAt, cutoff),
        )!;
        const candidates = this.db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eligible)
          .orderBy(
            sql`least(${sessions.expiresAt}, coalesce(${sessions.revokedAt}, 'infinity'::timestamptz))`,
            sessions.id,
          )
          .limit(limit)
          .for('update', { skipLocked: true });
        return (
          await this.db
            .delete(sessions)
            .where(and(eligible, inArray(sessions.id, candidates)))
            .returning({ id: sessions.id })
        ).length;
      }
      case 'accountTokens': {
        const eligible = or(
          lte(accountTokens.expiresAt, cutoff),
          lte(accountTokens.consumedAt, cutoff),
          lte(accountTokens.invalidatedAt, cutoff),
        )!;
        const candidates = this.db
          .select({ id: accountTokens.id })
          .from(accountTokens)
          .where(eligible)
          .orderBy(
            sql`least(${accountTokens.expiresAt}, coalesce(${accountTokens.consumedAt}, 'infinity'::timestamptz), coalesce(${accountTokens.invalidatedAt}, 'infinity'::timestamptz))`,
            accountTokens.id,
          )
          .limit(limit)
          .for('update', { skipLocked: true });
        return (
          await this.db
            .delete(accountTokens)
            .where(and(eligible, inArray(accountTokens.id, candidates)))
            .returning({ id: accountTokens.id })
        ).length;
      }
      case 'pendingEmailChanges': {
        const eligible = lte(pendingEmailChanges.expiresAt, cutoff);
        const candidates = this.db
          .select({ id: pendingEmailChanges.id })
          .from(pendingEmailChanges)
          .where(eligible)
          .orderBy(pendingEmailChanges.expiresAt, pendingEmailChanges.id)
          .limit(limit)
          .for('update', { skipLocked: true });
        return (
          await this.db
            .delete(pendingEmailChanges)
            .where(and(eligible, inArray(pendingEmailChanges.id, candidates)))
            .returning({ id: pendingEmailChanges.id })
        ).length;
      }
      case 'readNotifications':
      case 'unreadNotifications': {
        const read = target === 'readNotifications';
        const eligible = and(
          eq(notifications.isRead, read),
          lte(notifications.updatedAt, cutoff),
        )!;
        const candidates = this.db
          .select({ id: notifications.id })
          .from(notifications)
          .where(eligible)
          .orderBy(notifications.updatedAt, notifications.id)
          .limit(limit)
          .for('update', { skipLocked: true });
        return (
          await this.db
            .delete(notifications)
            .where(and(eligible, inArray(notifications.id, candidates)))
            .returning({ id: notifications.id })
        ).length;
      }
      case 'carts': {
        const eligible = lte(carts.updatedAt, cutoff);
        const candidates = this.db
          .select({ id: carts.id })
          .from(carts)
          .where(eligible)
          .orderBy(carts.updatedAt, carts.id)
          .limit(limit)
          .for('update', { skipLocked: true });
        return (
          await this.db
            .delete(carts)
            .where(and(eligible, inArray(carts.id, candidates)))
            .returning({ id: carts.id })
        ).length;
      }
    }
  }

  async previewEligible(target: CleanupTarget, cutoff: Date, limit: number) {
    const previewLimit = limit + 1;
    switch (target) {
      case 'sessions':
        return preview(
          await this.db
            .select({ id: sessions.id })
            .from(sessions)
            .where(
              or(
                lte(sessions.expiresAt, cutoff),
                lte(sessions.revokedAt, cutoff),
              ),
            )
            .orderBy(
              sql`least(${sessions.expiresAt}, coalesce(${sessions.revokedAt}, 'infinity'::timestamptz))`,
              sessions.id,
            )
            .limit(previewLimit),
          limit,
        );
      case 'accountTokens':
        return preview(
          await this.db
            .select({ id: accountTokens.id })
            .from(accountTokens)
            .where(
              or(
                lte(accountTokens.expiresAt, cutoff),
                lte(accountTokens.consumedAt, cutoff),
                lte(accountTokens.invalidatedAt, cutoff),
              ),
            )
            .orderBy(
              sql`least(${accountTokens.expiresAt}, coalesce(${accountTokens.consumedAt}, 'infinity'::timestamptz), coalesce(${accountTokens.invalidatedAt}, 'infinity'::timestamptz))`,
              accountTokens.id,
            )
            .limit(previewLimit),
          limit,
        );
      case 'pendingEmailChanges':
        return preview(
          await this.db
            .select({ id: pendingEmailChanges.id })
            .from(pendingEmailChanges)
            .where(lte(pendingEmailChanges.expiresAt, cutoff))
            .orderBy(pendingEmailChanges.expiresAt, pendingEmailChanges.id)
            .limit(previewLimit),
          limit,
        );
      case 'readNotifications':
      case 'unreadNotifications': {
        const read = target === 'readNotifications';
        return preview(
          await this.db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                eq(notifications.isRead, read),
                lte(notifications.updatedAt, cutoff),
              ),
            )
            .orderBy(notifications.updatedAt, notifications.id)
            .limit(previewLimit),
          limit,
        );
      }
      case 'carts':
        return preview(
          await this.db
            .select({ id: carts.id })
            .from(carts)
            .where(lte(carts.updatedAt, cutoff))
            .orderBy(carts.updatedAt, carts.id)
            .limit(previewLimit),
          limit,
        );
    }
  }
}
