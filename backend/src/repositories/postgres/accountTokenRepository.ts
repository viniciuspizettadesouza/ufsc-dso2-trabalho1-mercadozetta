import { and, count, desc, eq, gt, gte, isNull, lt, ne, or } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { accountTokens } from '@/database/schema';
import type {
  AccountTokenInvalidationReason,
  AccountTokenPurpose,
  AccountTokenRecord,
  AccountTokenRepository,
  ConsumeAccountToken,
  CreateAccountTokenRecord,
} from '@/repositories/accountTokenRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

function mapAccountToken(
  row: typeof accountTokens.$inferSelect,
): AccountTokenRecord {
  return {
    _id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    purpose: row.purpose as AccountTokenPurpose,
    tokenHash: row.tokenHash,
    tokenHashSecretVersion: row.tokenHashSecretVersion,
    ...(row.emailVersion === null ? {} : { emailVersion: row.emailVersion }),
    expiresAt: row.expiresAt,
    ...(row.consumedAt ? { consumedAt: row.consumedAt } : {}),
    ...(row.invalidatedAt ? { invalidatedAt: row.invalidatedAt } : {}),
    ...(row.invalidationReason
      ? {
          invalidationReason:
            row.invalidationReason as AccountTokenInvalidationReason,
        }
      : {}),
    createdAt: row.createdAt,
  };
}

export class PostgresAccountTokenRepository implements AccountTokenRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async create(input: CreateAccountTokenRecord) {
    const [created] = await this.db
      .insert(accountTokens)
      .values({
        id: input._id,
        tenantId: input.tenantId,
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        tokenHashSecretVersion: input.tokenHashSecretVersion,
        emailVersion: input.emailVersion,
        expiresAt: input.expiresAt,
        consumedAt: input.consumedAt,
        invalidatedAt: input.invalidatedAt,
        invalidationReason: input.invalidationReason,
        createdAt: input.createdAt,
      })
      .returning();
    return mapAccountToken(created);
  }

  async findById(tenantId: string, tokenId: string) {
    const [token] = await this.db
      .select()
      .from(accountTokens)
      .where(
        and(
          eq(accountTokens.tenantId, tenantId),
          eq(accountTokens.id, tokenId),
        ),
      )
      .limit(1);
    return token ? mapAccountToken(token) : null;
  }

  async consume(input: ConsumeAccountToken) {
    const emailVersionCondition =
      input.emailVersion === undefined
        ? isNull(accountTokens.emailVersion)
        : eq(accountTokens.emailVersion, input.emailVersion);
    const [consumed] = await this.db
      .update(accountTokens)
      .set({ consumedAt: input.now })
      .where(
        and(
          eq(accountTokens.tenantId, input.tenantId),
          eq(accountTokens.id, input.tokenId),
          eq(accountTokens.purpose, input.purpose),
          eq(accountTokens.tokenHash, input.tokenHash),
          emailVersionCondition,
          isNull(accountTokens.consumedAt),
          isNull(accountTokens.invalidatedAt),
          gt(accountTokens.expiresAt, input.now),
        ),
      )
      .returning();
    return consumed ? mapAccountToken(consumed) : null;
  }

  async invalidateActive(
    tenantId: string,
    userId: string,
    purpose: AccountTokenPurpose,
    reason: AccountTokenInvalidationReason,
    now: Date,
    exceptTokenId?: string,
  ) {
    const invalidated = await this.db
      .update(accountTokens)
      .set({ invalidatedAt: now, invalidationReason: reason })
      .where(
        and(
          eq(accountTokens.tenantId, tenantId),
          eq(accountTokens.userId, userId),
          eq(accountTokens.purpose, purpose),
          isNull(accountTokens.consumedAt),
          isNull(accountTokens.invalidatedAt),
          ...(exceptTokenId ? [ne(accountTokens.id, exceptTokenId)] : []),
        ),
      )
      .returning({ id: accountTokens.id });
    return invalidated.length;
  }

  async countIssuedSince(
    tenantId: string,
    userId: string,
    purpose: AccountTokenPurpose,
    since: Date,
  ) {
    const [result] = await this.db
      .select({ value: count() })
      .from(accountTokens)
      .where(
        and(
          eq(accountTokens.tenantId, tenantId),
          eq(accountTokens.userId, userId),
          eq(accountTokens.purpose, purpose),
          gte(accountTokens.createdAt, since),
        ),
      );
    return result.value;
  }

  async findLatestIssuedAt(
    tenantId: string,
    userId: string,
    purpose: AccountTokenPurpose,
  ) {
    const [result] = await this.db
      .select({ createdAt: accountTokens.createdAt })
      .from(accountTokens)
      .where(
        and(
          eq(accountTokens.tenantId, tenantId),
          eq(accountTokens.userId, userId),
          eq(accountTokens.purpose, purpose),
        ),
      )
      .orderBy(desc(accountTokens.createdAt), desc(accountTokens.id))
      .limit(1);
    return result?.createdAt ?? null;
  }

  async deleteRetired(before: Date) {
    const deleted = await this.db
      .delete(accountTokens)
      .where(
        or(
          lt(accountTokens.expiresAt, before),
          lt(accountTokens.consumedAt, before),
          lt(accountTokens.invalidatedAt, before),
        ),
      )
      .returning({ id: accountTokens.id });
    return deleted.length;
  }
}
