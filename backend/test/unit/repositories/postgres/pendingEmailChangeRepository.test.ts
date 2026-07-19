import { describe, expect, it, vi } from 'vitest';
import { DuplicatePendingEmailError } from '@/repositories/pendingEmailChangeRepository';
import { PostgresPendingEmailChangeRepository } from '@/repositories/postgres/pendingEmailChangeRepository';

function databaseReturning(result: unknown) {
  const chain: Record<string, any> = {};
  for (const method of [
    'from',
    'values',
    'onConflictDoUpdate',
    'where',
    'limit',
    'for',
    'returning',
  ])
    chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve(result));

  return {
    database: {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      delete: vi.fn(() => chain),
    },
    chain,
  };
}

const changeRow = {
  id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  userId: '607f1f77-bcf8-4ecd-8994-390120000002',
  email: 'replacement@example.com',
  emailVersion: 2,
  expiresAt: new Date('2026-07-19T10:30:00.000Z'),
  createdAt: new Date('2026-07-19T10:00:00.000Z'),
};

describe('PostgresPendingEmailChangeRepository', () => {
  it('saves and maps one replaceable tenant/user change', async () => {
    const { database, chain } = databaseReturning([changeRow]);
    const repository = new PostgresPendingEmailChangeRepository(
      database as never,
    );

    await expect(
      repository.save({
        _id: changeRow.id,
        tenantId: changeRow.tenantId,
        userId: changeRow.userId,
        email: changeRow.email,
        emailVersion: changeRow.emailVersion,
        expiresAt: changeRow.expiresAt,
        createdAt: changeRow.createdAt,
      }),
    ).resolves.toEqual({
      _id: changeRow.id,
      tenantId: changeRow.tenantId,
      userId: changeRow.userId,
      email: changeRow.email,
      emailVersion: 2,
      expiresAt: changeRow.expiresAt,
      createdAt: changeRow.createdAt,
    });
    expect(chain.onConflictDoUpdate).toHaveBeenCalledOnce();
  });

  it('maps tenant email conflicts without swallowing other failures', async () => {
    let fake = databaseReturning([]);
    const duplicate = new Error('wrapped PostgreSQL error') as Error & {
      cause: unknown;
    };
    duplicate.cause = {
      code: '23505',
      constraint: 'pending_email_changes_tenant_email_key',
    };
    fake.chain.values.mockImplementationOnce(() => {
      throw duplicate;
    });
    let repository = new PostgresPendingEmailChangeRepository(
      fake.database as never,
    );
    await expect(repository.save(changeRow as never)).rejects.toBeInstanceOf(
      DuplicatePendingEmailError,
    );

    fake = databaseReturning([]);
    const unavailable = new Error('database unavailable');
    fake.chain.values.mockImplementationOnce(() => {
      throw unavailable;
    });
    repository = new PostgresPendingEmailChangeRepository(
      fake.database as never,
    );
    await expect(repository.save(changeRow as never)).rejects.toBe(unavailable);
  });

  it('finds, locks, deletes, and expires changes within their scope', async () => {
    let fake = databaseReturning([changeRow]);
    let repository = new PostgresPendingEmailChangeRepository(
      fake.database as never,
    );
    await expect(
      repository.findByUser(changeRow.tenantId, changeRow.userId),
    ).resolves.toMatchObject({ _id: changeRow.id });
    await expect(
      repository.findByUserForUpdate(changeRow.tenantId, changeRow.userId),
    ).resolves.toMatchObject({ emailVersion: 2 });
    expect(fake.chain.for).toHaveBeenCalledWith('update');
    await expect(
      repository.deleteByUser(changeRow.tenantId, changeRow.userId),
    ).resolves.toBe(true);
    await expect(repository.deleteExpired(changeRow.expiresAt)).resolves.toBe(
      1,
    );

    fake = databaseReturning([]);
    repository = new PostgresPendingEmailChangeRepository(
      fake.database as never,
    );
    await expect(
      repository.findByUser(changeRow.tenantId, changeRow.userId),
    ).resolves.toBeNull();
    await expect(
      repository.findByUserForUpdate(changeRow.tenantId, changeRow.userId),
    ).resolves.toBeNull();
    await expect(
      repository.deleteByUser(changeRow.tenantId, changeRow.userId),
    ).resolves.toBe(false);
    await expect(repository.deleteExpired(changeRow.expiresAt)).resolves.toBe(
      0,
    );
  });
});
