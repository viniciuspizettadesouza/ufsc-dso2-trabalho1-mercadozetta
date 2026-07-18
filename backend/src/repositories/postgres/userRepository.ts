import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { users } from '@/database/schema';
import { mapUserRow } from '@/repositories/mappers';
import {
  DuplicateUserEmailError,
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

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async emailExists(tenantId: string, email: string) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
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
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
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
        ),
      )
      .limit(1);
    return user
      ? {
          ...mapUserRow(user),
          passwordHash: user.passwordHash,
          tokenVersion: user.tokenVersion,
        }
      : null;
  }

  async findTokenVersion(tenantId: string, userId: string) {
    const [user] = await this.db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
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
