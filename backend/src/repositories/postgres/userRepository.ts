import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { users } from '@/database/schema';
import { mapUserRow } from '@/repositories/mappers';
import {
  DuplicateUserEmailError,
  type AccountSecurityUser,
  type CreateUserRecord,
  type UserRepository,
} from '@/repositories/userRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

type PostgresError = {
  code?: string;
  constraint?: string;
  cause?: unknown;
};

function isEmailDuplicate(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const postgresError = error as PostgresError;
  if (
    postgresError.code === '23505' &&
    postgresError.constraint === 'users_tenant_email_key'
  )
    return true;
  return isEmailDuplicate(postgresError.cause);
}

function mapAccountSecurityUser(
  user: typeof users.$inferSelect,
): AccountSecurityUser {
  return {
    _id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    emailVersion: user.emailVersion,
    passwordHash: user.passwordHash,
    tokenVersion: user.tokenVersion,
    deactivatedAt: user.deactivatedAt,
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async emailExists(tenantId: string, email: string) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      )
      .limit(1);
    return rows.length === 1;
  }

  async create(user: CreateUserRecord) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(user.password, 10);

    try {
      const [created] = await this.db
        .insert(users)
        .values({
          id: randomUUID(),
          tenantId: user.tenantId,
          email: user.email,
          passwordHash,
          username: user.username.toLowerCase(),
          telephone: user.telephone.toLowerCase(),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapUserRow(created);
    } catch (error) {
      if (isEmailDuplicate(error)) throw new DuplicateUserEmailError();
      throw error;
    }
  }

  async findPublicById(tenantId: string, userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          isNull(users.deactivatedAt),
        ),
      )
      .limit(1);
    return user ? mapUserRow(user) : null;
  }

  async findForAuthentication(tenantId: string, email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          sql`lower(${users.email}) = lower(${email})`,
          isNull(users.deactivatedAt),
        ),
      )
      .limit(1);
    return user
      ? {
          ...mapUserRow(user),
          passwordHash: user.passwordHash,
          tokenVersion: user.tokenVersion,
          deactivatedAt: user.deactivatedAt,
        }
      : null;
  }

  async findForAccountSecurity(tenantId: string, email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      )
      .limit(1);
    return user ? mapAccountSecurityUser(user) : null;
  }

  async findForAccountSecurityForUpdate(tenantId: string, email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      )
      .limit(1)
      .for('update');
    return user ? mapAccountSecurityUser(user) : null;
  }

  async findAccountSecurityById(tenantId: string, userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          isNull(users.deactivatedAt),
        ),
      )
      .limit(1);
    return user ? mapAccountSecurityUser(user) : null;
  }

  async findAccountSecurityByIdForUpdate(tenantId: string, userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1)
      .for('update');
    return user ? mapAccountSecurityUser(user) : null;
  }

  async updateProfile(
    tenantId: string,
    userId: string,
    fields: { username?: string; telephone?: string | null },
    now: Date,
  ) {
    const [updated] = await this.db
      .update(users)
      .set({ ...fields, updatedAt: now })
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          isNull(users.deactivatedAt),
        ),
      )
      .returning();
    return updated ? mapUserRow(updated) : null;
  }

  async replaceAccountPassword(input: {
    tenantId: string;
    userId: string;
    expectedPasswordHash: string;
    expectedTokenVersion: number;
    passwordHash: string;
    now: Date;
  }) {
    const updated = await this.db
      .update(users)
      .set({
        passwordHash: input.passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(users.tenantId, input.tenantId),
          eq(users.id, input.userId),
          eq(users.passwordHash, input.expectedPasswordHash),
          eq(users.tokenVersion, input.expectedTokenVersion),
          isNull(users.deactivatedAt),
        ),
      )
      .returning({ id: users.id });
    return updated.length === 1;
  }

  async promoteAccountEmail(input: {
    tenantId: string;
    userId: string;
    expectedEmailVersion: number;
    email: string;
    now: Date;
  }) {
    try {
      const updated = await this.db
        .update(users)
        .set({
          email: input.email,
          emailVersion: sql`${users.emailVersion} + 1`,
          emailVerifiedAt: input.now,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(users.tenantId, input.tenantId),
            eq(users.id, input.userId),
            eq(users.emailVersion, input.expectedEmailVersion),
            isNull(users.deactivatedAt),
          ),
        )
        .returning({ id: users.id });
      return updated.length === 1;
    } catch (error) {
      if (isEmailDuplicate(error)) throw new DuplicateUserEmailError();
      throw error;
    }
  }

  async deactivateAccount(input: {
    tenantId: string;
    userId: string;
    expectedPasswordHash: string;
    expectedTokenVersion: number;
    passwordHash: string;
    now: Date;
  }) {
    const updated = await this.db
      .update(users)
      .set({
        passwordHash: input.passwordHash,
        username: null,
        telephone: null,
        deactivatedAt: input.now,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(users.tenantId, input.tenantId),
          eq(users.id, input.userId),
          eq(users.passwordHash, input.expectedPasswordHash),
          eq(users.tokenVersion, input.expectedTokenVersion),
          isNull(users.deactivatedAt),
        ),
      )
      .returning({ id: users.id });
    return updated.length === 1;
  }

  async markEmailVerified(
    tenantId: string,
    userId: string,
    emailVersion: number,
    now: Date,
  ) {
    const updated = await this.db
      .update(users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          eq(users.emailVersion, emailVersion),
        ),
      )
      .returning({ id: users.id });
    return updated.length === 1;
  }

  async replacePasswordAndIncrementTokenVersion(
    tenantId: string,
    userId: string,
    passwordHash: string,
    now: Date,
  ) {
    const updated = await this.db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: now,
      })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .returning({ id: users.id });
    return updated.length === 1;
  }

  async findTokenVersion(tenantId: string, userId: string) {
    const [user] = await this.db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          isNull(users.deactivatedAt),
        ),
      )
      .limit(1);
    return user?.tokenVersion ?? null;
  }

  async hasTokenVersion(
    tenantId: string,
    userId: string,
    tokenVersion: number,
  ) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.id, userId),
          eq(users.tokenVersion, tokenVersion),
          isNull(users.deactivatedAt),
        ),
      )
      .limit(1);
    return Boolean(user);
  }

  async incrementTokenVersion(tenantId: string, userId: string) {
    const updated = await this.db
      .update(users)
      .set({
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .returning({ id: users.id });
    return updated.length === 1;
  }
}
