import { and, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { sessions } from '@/database/schema';
import type {
  CreateSessionRecord,
  RotateSessionRecord,
  SessionRecord,
  SessionRepository,
} from '@/repositories/sessionRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

function mapSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    _id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    familyId: row.familyId,
    tokenVersion: row.tokenVersion,
    refreshTokenHash: row.refreshTokenHash,
    ...(row.refreshTokenSecretVersion
      ? { refreshTokenSecretVersion: row.refreshTokenSecretVersion }
      : {}),
    ...(row.previousRefreshTokenHash
      ? { previousRefreshTokenHash: row.previousRefreshTokenHash }
      : {}),
    ...(row.previousRefreshTokenSecretVersion
      ? {
          previousRefreshTokenSecretVersion:
            row.previousRefreshTokenSecretVersion,
        }
      : {}),
    rotationCounter: row.rotationCounter,
    ...(row.rotatedAt ? { rotatedAt: row.rotatedAt } : {}),
    lastUsedAt: row.lastUsedAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    expiresAt: row.expiresAt,
    ...(row.revokedAt ? { revokedAt: row.revokedAt } : {}),
    ...(row.revokeReason ? { revokeReason: row.revokeReason } : {}),
    ...(row.userAgentLabel ? { userAgentLabel: row.userAgentLabel } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async create(input: CreateSessionRecord) {
    const [session] = await this.db
      .insert(sessions)
      .values({
        id: input._id,
        tenantId: input.tenantId,
        userId: input.userId,
        familyId: input.familyId,
        tokenVersion: input.tokenVersion,
        refreshTokenHash: input.refreshTokenHash,
        refreshTokenSecretVersion: input.refreshTokenSecretVersion,
        rotationCounter: input.rotationCounter,
        lastUsedAt: input.lastUsedAt,
        absoluteExpiresAt: input.absoluteExpiresAt,
        expiresAt: input.expiresAt,
        userAgentLabel: input.userAgentLabel,
        createdAt: input.createdAt!,
        updatedAt: input.updatedAt!,
      })
      .returning();
    return mapSession(session);
  }

  async findRefreshById(tenantId: string, sessionId: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.id, sessionId)))
      .limit(1);
    return session ? mapSession(session) : null;
  }

  async rotateCurrent(input: RotateSessionRecord) {
    const updated = await this.db
      .update(sessions)
      .set({
        previousRefreshTokenHash: input.expectedRefreshTokenHash,
        previousRefreshTokenSecretVersion:
          input.previousRefreshTokenSecretVersion,
        refreshTokenHash: input.nextRefreshTokenHash,
        refreshTokenSecretVersion: input.nextRefreshTokenSecretVersion,
        rotationCounter: sql`${sessions.rotationCounter} + 1`,
        rotatedAt: input.now,
        lastUsedAt: input.now,
        expiresAt: input.expiresAt,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(sessions.tenantId, input.tenantId),
          eq(sessions.id, input.sessionId),
          eq(sessions.refreshTokenHash, input.expectedRefreshTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, input.now),
          gt(sessions.absoluteExpiresAt, input.now),
        ),
      )
      .returning({ id: sessions.id });
    return updated.length === 1;
  }

  async revokeById(
    tenantId: string,
    sessionId: string,
    reason: string,
    now: Date,
  ) {
    await this.db
      .update(sessions)
      .set({ revokedAt: now, revokeReason: reason, updatedAt: now })
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.id, sessionId)));
  }

  async findOwned(tenantId: string, userId: string, sessionId: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          eq(sessions.userId, userId),
          eq(sessions.id, sessionId),
        ),
      )
      .limit(1);
    return session ? mapSession(session) : null;
  }

  async listActive(tenantId: string, userId: string, now: Date) {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          gt(sessions.absoluteExpiresAt, now),
        ),
      )
      .orderBy(desc(sessions.createdAt), desc(sessions.id));
    return rows.map(mapSession);
  }

  async revokeOwned(
    tenantId: string,
    userId: string,
    sessionId: string,
    reason: string,
    now: Date,
  ) {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: now, revokeReason: reason, updatedAt: now })
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          eq(sessions.userId, userId),
          eq(sessions.id, sessionId),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    return rows.length === 1;
  }

  async revokeAll(tenantId: string, userId: string, reason: string, now: Date) {
    await this.db
      .update(sessions)
      .set({ revokedAt: now, revokeReason: reason, updatedAt: now })
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async isActive(
    tenantId: string,
    userId: string,
    sessionId: string,
    tokenVersion: number,
    now: Date,
  ) {
    const [session] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          eq(sessions.userId, userId),
          eq(sessions.id, sessionId),
          eq(sessions.tokenVersion, tokenVersion),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          gt(sessions.absoluteExpiresAt, now),
        ),
      )
      .limit(1);
    return Boolean(session);
  }

  async deleteExpired(now: Date) {
    return (
      await this.db
        .delete(sessions)
        .where(lte(sessions.expiresAt, now))
        .returning({ id: sessions.id })
    ).length;
  }
}
