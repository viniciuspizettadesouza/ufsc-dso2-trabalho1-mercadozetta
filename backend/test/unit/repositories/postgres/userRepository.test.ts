import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { DuplicateUserEmailError } from '@/repositories/userRepository';
import { PostgresUserRepository } from '@/repositories/postgres/userRepository';

function databaseReturning(result: unknown) {
  const chain: Record<string, any> = {};
  for (const method of [
    'from',
    'values',
    'set',
    'where',
    'limit',
    'returning',
    'for',
  ])
    chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve(result));

  return {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    chain,
  };
}

describe('PostgresUserRepository account security operations', () => {
  const userRow = {
    id: '507f1f77-bcf8-4ecd-8994-390110000001',
    tenantId: 'mercadozetta',
    email: 'seller@example.com',
    passwordHash: 'stored-password-hash',
    tokenVersion: 3,
    emailVerifiedAt: null,
    emailVersion: 1,
    deactivatedAt: null,
    username: 'seller',
    telephone: '123',
    createdAt: new Date('2026-07-18T10:00:00.000Z'),
    updatedAt: new Date('2026-07-18T10:00:00.000Z'),
  };

  it('checks uniqueness and creates a password-hashed public user', async () => {
    let database = databaseReturning([{ id: userRow.id }]);
    let repository = new PostgresUserRepository(database as never);
    await expect(
      repository.emailExists('mercadozetta', 'seller@example.com'),
    ).resolves.toBe(true);

    database = databaseReturning([]);
    repository = new PostgresUserRepository(database as never);
    await expect(
      repository.emailExists('mercadozetta', 'missing@example.com'),
    ).resolves.toBe(false);

    database = databaseReturning([userRow]);
    repository = new PostgresUserRepository(database as never);
    await expect(
      repository.create({
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        password: 'secret123',
        username: 'Seller',
        telephone: '123',
      }),
    ).resolves.toMatchObject({
      _id: userRow.id,
      email: 'seller@example.com',
      username: 'seller',
    });
    const inserted = database.chain.values.mock.calls[0][0];
    expect(inserted.passwordHash).not.toBe('secret123');
    await expect(
      bcrypt.compare('secret123', inserted.passwordHash),
    ).resolves.toBe(true);
  });

  it('maps duplicate insert races and preserves unrelated failures', async () => {
    let database = databaseReturning([]);
    const duplicate = new Error('wrapped PostgreSQL error') as Error & {
      cause: unknown;
    };
    duplicate.cause = {
      code: '23505',
      constraint: 'users_tenant_email_key',
    };
    database.chain.values.mockImplementationOnce(() => {
      throw duplicate;
    });
    let repository = new PostgresUserRepository(database as never);
    await expect(
      repository.create({
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        password: 'secret123',
        username: 'Seller',
        telephone: '123',
      }),
    ).rejects.toBeInstanceOf(DuplicateUserEmailError);

    database = databaseReturning([]);
    const unrelated = new Error('database unavailable');
    database.chain.values.mockImplementationOnce(() => {
      throw unrelated;
    });
    repository = new PostgresUserRepository(database as never);
    await expect(
      repository.create({
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        password: 'secret123',
        username: 'Seller',
        telephone: '123',
      }),
    ).rejects.toBe(unrelated);
  });

  it('reads public, authentication, and token-version state', async () => {
    let repository = new PostgresUserRepository(
      databaseReturning([userRow]) as never,
    );
    await expect(
      repository.findPublicById('mercadozetta', userRow.id),
    ).resolves.toMatchObject({ _id: userRow.id, email: userRow.email });
    await expect(
      repository.findForAuthentication('mercadozetta', userRow.email),
    ).resolves.toMatchObject({
      _id: userRow.id,
      passwordHash: userRow.passwordHash,
      tokenVersion: 3,
      deactivatedAt: null,
    });

    repository = new PostgresUserRepository(databaseReturning([]) as never);
    await expect(
      repository.findPublicById('mercadozetta', userRow.id),
    ).resolves.toBeNull();
    await expect(
      repository.findForAuthentication('mercadozetta', userRow.email),
    ).resolves.toBeNull();

    repository = new PostgresUserRepository(
      databaseReturning([{ tokenVersion: 3 }]) as never,
    );
    await expect(
      repository.findTokenVersion('mercadozetta', userRow.id),
    ).resolves.toBe(3);
    await expect(
      repository.hasTokenVersion('mercadozetta', userRow.id, 3),
    ).resolves.toBe(true);
    await expect(
      repository.incrementTokenVersion('mercadozetta', userRow.id),
    ).resolves.toBe(true);

    repository = new PostgresUserRepository(databaseReturning([]) as never);
    await expect(
      repository.findTokenVersion('mercadozetta', userRow.id),
    ).resolves.toBeNull();
    await expect(
      repository.hasTokenVersion('mercadozetta', userRow.id, 4),
    ).resolves.toBe(false);
    await expect(
      repository.incrementTokenVersion('campus-market', userRow.id),
    ).resolves.toBe(false);
  });

  it('returns only the internal state needed by account-security flows', async () => {
    let repository = new PostgresUserRepository(
      databaseReturning([userRow]) as never,
    );

    await expect(
      repository.findForAccountSecurity('mercadozetta', 'seller@example.com'),
    ).resolves.toEqual({
      _id: userRow.id,
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
      emailVerifiedAt: null,
      emailVersion: 1,
      passwordHash: 'stored-password-hash',
      tokenVersion: 3,
      deactivatedAt: null,
    });
    await expect(
      repository.findForAccountSecurityForUpdate(
        'mercadozetta',
        'seller@example.com',
      ),
    ).resolves.toMatchObject({ _id: userRow.id, emailVersion: 1 });
    await expect(
      repository.findAccountSecurityById('mercadozetta', userRow.id),
    ).resolves.toMatchObject({ _id: userRow.id, tokenVersion: 3 });
    await expect(
      repository.findAccountSecurityByIdForUpdate('mercadozetta', userRow.id),
    ).resolves.toMatchObject({ _id: userRow.id, deactivatedAt: null });

    repository = new PostgresUserRepository(databaseReturning([]) as never);
    await expect(
      repository.findForAccountSecurity('mercadozetta', 'missing@example.com'),
    ).resolves.toBeNull();
    await expect(
      repository.findForAccountSecurityForUpdate(
        'mercadozetta',
        'missing@example.com',
      ),
    ).resolves.toBeNull();
    await expect(
      repository.findAccountSecurityById('mercadozetta', userRow.id),
    ).resolves.toBeNull();
    await expect(
      repository.findAccountSecurityByIdForUpdate('mercadozetta', userRow.id),
    ).resolves.toBeNull();
  });

  it('conditionally verifies email and replaces password credentials', async () => {
    let database = databaseReturning([{ id: userRow.id }]);
    let repository = new PostgresUserRepository(database as never);
    const now = new Date('2026-07-18T11:00:00.000Z');

    await expect(
      repository.markEmailVerified('mercadozetta', userRow.id, 1, now),
    ).resolves.toBe(true);
    await expect(
      repository.replacePasswordAndIncrementTokenVersion(
        'mercadozetta',
        userRow.id,
        'replacement-hash',
        now,
      ),
    ).resolves.toBe(true);

    database = databaseReturning([]);
    repository = new PostgresUserRepository(database as never);
    await expect(
      repository.markEmailVerified('mercadozetta', userRow.id, 2, now),
    ).resolves.toBe(false);
    await expect(
      repository.replacePasswordAndIncrementTokenVersion(
        'campus-market',
        userRow.id,
        'replacement-hash',
        now,
      ),
    ).resolves.toBe(false);
  });

  it('persists conditional account-management state transitions', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    let database = databaseReturning([userRow]);
    let repository = new PostgresUserRepository(database as never);

    await expect(
      repository.updateProfile(
        'mercadozetta',
        userRow.id,
        { username: 'updated', telephone: null },
        now,
      ),
    ).resolves.toMatchObject({ _id: userRow.id });
    await expect(
      repository.replaceAccountPassword({
        tenantId: 'mercadozetta',
        userId: userRow.id,
        expectedPasswordHash: userRow.passwordHash,
        expectedTokenVersion: 3,
        passwordHash: 'replacement-hash',
        now,
      }),
    ).resolves.toBe(true);
    await expect(
      repository.promoteAccountEmail({
        tenantId: 'mercadozetta',
        userId: userRow.id,
        expectedEmailVersion: 1,
        email: 'replacement@example.com',
        now,
      }),
    ).resolves.toBe(true);
    await expect(
      repository.deactivateAccount({
        tenantId: 'mercadozetta',
        userId: userRow.id,
        expectedPasswordHash: userRow.passwordHash,
        expectedTokenVersion: 3,
        passwordHash: 'unusable-hash',
        now,
      }),
    ).resolves.toBe(true);
    expect(database.chain.set).toHaveBeenLastCalledWith({
      passwordHash: 'unusable-hash',
      username: null,
      telephone: null,
      deactivatedAt: now,
      tokenVersion: expect.anything(),
      updatedAt: now,
    });

    database = databaseReturning([]);
    repository = new PostgresUserRepository(database as never);
    await expect(
      repository.updateProfile(
        'campus-market',
        userRow.id,
        { username: 'wrong tenant' },
        now,
      ),
    ).resolves.toBeNull();
    await expect(
      repository.replaceAccountPassword({
        tenantId: 'campus-market',
        userId: userRow.id,
        expectedPasswordHash: userRow.passwordHash,
        expectedTokenVersion: 3,
        passwordHash: 'replacement-hash',
        now,
      }),
    ).resolves.toBe(false);
    await expect(
      repository.promoteAccountEmail({
        tenantId: 'campus-market',
        userId: userRow.id,
        expectedEmailVersion: 1,
        email: 'replacement@example.com',
        now,
      }),
    ).resolves.toBe(false);
    await expect(
      repository.deactivateAccount({
        tenantId: 'campus-market',
        userId: userRow.id,
        expectedPasswordHash: userRow.passwordHash,
        expectedTokenVersion: 3,
        passwordHash: 'unusable-hash',
        now,
      }),
    ).resolves.toBe(false);
  });

  it('maps email promotion uniqueness races', async () => {
    const database = databaseReturning([]);
    const duplicate = {
      code: '23505',
      constraint: 'users_tenant_email_key',
    };
    database.chain.set.mockImplementationOnce(() => {
      throw duplicate;
    });
    const repository = new PostgresUserRepository(database as never);

    await expect(
      repository.promoteAccountEmail({
        tenantId: 'mercadozetta',
        userId: userRow.id,
        expectedEmailVersion: 1,
        email: 'replacement@example.com',
        now: new Date('2026-07-19T12:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(DuplicateUserEmailError);
  });
});
