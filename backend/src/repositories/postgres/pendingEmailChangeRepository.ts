import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { pendingEmailChanges } from '@/database/schema';
import {
  DuplicatePendingEmailError,
  type PendingEmailChangeRecord,
  type PendingEmailChangeRepository,
  type SavePendingEmailChange,
} from '@/repositories/pendingEmailChangeRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

type PostgresError = {
  code?: string;
  constraint?: string;
  cause?: unknown;
};

function isPendingEmailDuplicate(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const postgresError = error as PostgresError;
  if (
    postgresError.code === '23505' &&
    postgresError.constraint === 'pending_email_changes_tenant_email_key'
  )
    return true;
  return isPendingEmailDuplicate(postgresError.cause);
}

function mapPendingEmailChange(
  row: typeof pendingEmailChanges.$inferSelect,
): PendingEmailChangeRecord {
  return {
    _id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    email: row.email,
    emailVersion: row.emailVersion,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export class PostgresPendingEmailChangeRepository implements PendingEmailChangeRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async save(input: SavePendingEmailChange) {
    try {
      const [saved] = await this.db
        .insert(pendingEmailChanges)
        .values({
          id: input._id,
          tenantId: input.tenantId,
          userId: input.userId,
          email: input.email,
          emailVersion: input.emailVersion,
          expiresAt: input.expiresAt,
          createdAt: input.createdAt,
        })
        .onConflictDoUpdate({
          target: [pendingEmailChanges.tenantId, pendingEmailChanges.userId],
          set: {
            id: input._id,
            email: input.email,
            emailVersion: input.emailVersion,
            expiresAt: input.expiresAt,
            createdAt: input.createdAt,
          },
        })
        .returning();
      return mapPendingEmailChange(saved);
    } catch (error) {
      if (isPendingEmailDuplicate(error))
        throw new DuplicatePendingEmailError();
      throw error;
    }
  }

  async findByUser(tenantId: string, userId: string) {
    const [change] = await this.db
      .select()
      .from(pendingEmailChanges)
      .where(
        and(
          eq(pendingEmailChanges.tenantId, tenantId),
          eq(pendingEmailChanges.userId, userId),
        ),
      )
      .limit(1);
    return change ? mapPendingEmailChange(change) : null;
  }

  async findByUserForUpdate(tenantId: string, userId: string) {
    const [change] = await this.db
      .select()
      .from(pendingEmailChanges)
      .where(
        and(
          eq(pendingEmailChanges.tenantId, tenantId),
          eq(pendingEmailChanges.userId, userId),
        ),
      )
      .limit(1)
      .for('update');
    return change ? mapPendingEmailChange(change) : null;
  }

  async deleteByUser(tenantId: string, userId: string) {
    const deleted = await this.db
      .delete(pendingEmailChanges)
      .where(
        and(
          eq(pendingEmailChanges.tenantId, tenantId),
          eq(pendingEmailChanges.userId, userId),
        ),
      )
      .returning({ id: pendingEmailChanges.id });
    return deleted.length === 1;
  }

  async deleteExpired(before: Date) {
    const deleted = await this.db
      .delete(pendingEmailChanges)
      .where(lt(pendingEmailChanges.expiresAt, before))
      .returning({ id: pendingEmailChanges.id });
    return deleted.length;
  }
}
