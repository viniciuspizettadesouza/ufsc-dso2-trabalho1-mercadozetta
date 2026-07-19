import { describe, expect, it, vi } from 'vitest';
import { PostgresAccountTokenRepository } from '@/repositories/postgres/accountTokenRepository';

function databaseReturning(result: unknown) {
  const chain: Record<string, any> = {};
  for (const method of [
    'from',
    'values',
    'set',
    'where',
    'orderBy',
    'limit',
    'returning',
  ])
    chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve(result));

  return {
    database: {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
    },
    chain,
  };
}

const now = new Date('2026-07-18T10:00:00.000Z');
const tokenRow = {
  id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  userId: '607f1f77-bcf8-4ecd-8994-390120000002',
  purpose: 'email_verification',
  tokenHash: 'a'.repeat(64),
  tokenHashSecretVersion: 'current',
  emailVersion: 2,
  expiresAt: new Date('2026-07-18T18:00:00.000Z'),
  consumedAt: new Date('2026-07-18T10:05:00.000Z'),
  invalidatedAt: null,
  invalidationReason: null,
  createdAt: now,
};

describe('PostgresAccountTokenRepository', () => {
  it('creates and maps complete account-token records', async () => {
    const { database } = databaseReturning([tokenRow]);
    const repository = new PostgresAccountTokenRepository(database as never);

    await expect(
      repository.create({
        _id: tokenRow.id,
        tenantId: tokenRow.tenantId,
        userId: tokenRow.userId,
        purpose: 'email_verification',
        tokenHash: tokenRow.tokenHash,
        tokenHashSecretVersion: tokenRow.tokenHashSecretVersion,
        emailVersion: 2,
        expiresAt: tokenRow.expiresAt,
        createdAt: now,
      }),
    ).resolves.toEqual({
      _id: tokenRow.id,
      tenantId: tokenRow.tenantId,
      userId: tokenRow.userId,
      purpose: 'email_verification',
      tokenHash: tokenRow.tokenHash,
      tokenHashSecretVersion: 'current',
      emailVersion: 2,
      expiresAt: tokenRow.expiresAt,
      consumedAt: tokenRow.consumedAt,
      createdAt: now,
    });
    expect(database.insert).toHaveBeenCalledOnce();
  });

  it('finds, consumes, and invalidates tenant-scoped tokens', async () => {
    let fake = databaseReturning([
      {
        ...tokenRow,
        emailVersion: null,
        consumedAt: null,
        invalidatedAt: now,
        invalidationReason: 'replaced',
      },
    ]);
    let repository = new PostgresAccountTokenRepository(fake.database as never);

    await expect(
      repository.findById('mercadozetta', tokenRow.id),
    ).resolves.toMatchObject({
      _id: tokenRow.id,
      invalidatedAt: now,
      invalidationReason: 'replaced',
    });

    fake = databaseReturning([]);
    repository = new PostgresAccountTokenRepository(fake.database as never);
    await expect(
      repository.findById('mercadozetta', tokenRow.id),
    ).resolves.toBeNull();
    await expect(
      repository.consume({
        tenantId: 'mercadozetta',
        tokenId: tokenRow.id,
        purpose: 'password_reset',
        tokenHash: tokenRow.tokenHash,
        now,
      }),
    ).resolves.toBeNull();

    fake = databaseReturning([tokenRow]);
    repository = new PostgresAccountTokenRepository(fake.database as never);
    await expect(
      repository.consume({
        tenantId: 'mercadozetta',
        tokenId: tokenRow.id,
        purpose: 'email_verification',
        tokenHash: tokenRow.tokenHash,
        emailVersion: 2,
        now,
      }),
    ).resolves.toMatchObject({ _id: tokenRow.id });
    await expect(
      repository.invalidateActive(
        'mercadozetta',
        tokenRow.userId,
        'email_change',
        'account_deactivated',
        now,
        tokenRow.id,
      ),
    ).resolves.toBe(1);
  });

  it('reports issuance state and deletes retired records', async () => {
    let fake = databaseReturning([{ value: 3 }]);
    let repository = new PostgresAccountTokenRepository(fake.database as never);
    await expect(
      repository.countIssuedSince(
        'mercadozetta',
        tokenRow.userId,
        'password_reset',
        now,
      ),
    ).resolves.toBe(3);

    fake = databaseReturning([{ createdAt: now }]);
    repository = new PostgresAccountTokenRepository(fake.database as never);
    await expect(
      repository.findLatestIssuedAt(
        'mercadozetta',
        tokenRow.userId,
        'password_reset',
      ),
    ).resolves.toEqual(now);

    fake = databaseReturning([]);
    repository = new PostgresAccountTokenRepository(fake.database as never);
    await expect(
      repository.findLatestIssuedAt(
        'mercadozetta',
        tokenRow.userId,
        'password_reset',
      ),
    ).resolves.toBeNull();
    await expect(repository.deleteRetired(now)).resolves.toBe(0);
  });
});
