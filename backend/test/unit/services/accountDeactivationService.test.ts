import { describe, expect, it, vi } from 'vitest';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { createAccountDeactivationService } from '@/services/accountDeactivationService';

const now = new Date('2026-07-19T15:00:00.000Z');
const user = {
  _id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  email: 'seller@example.com',
  emailVerifiedAt: now,
  emailVersion: 2,
  passwordHash: 'stored-password-hash',
  tokenVersion: 3,
  deactivatedAt: null,
};
const body = {
  currentPassword: ' current secret ',
  confirmation: 'DEACTIVATE',
};

function harness(overrides: Record<string, unknown> = {}) {
  const users = {
    findAccountSecurityById: vi.fn().mockResolvedValue(user),
    findAccountSecurityByIdForUpdate: vi.fn().mockResolvedValue(user),
    deactivateAccount: vi.fn().mockResolvedValue(true),
    ...(overrides.users as object),
  };
  const accountLifecycle = {
    hasActiveOrders: vi.fn().mockResolvedValue(false),
    archiveOwnedListings: vi.fn().mockResolvedValue(2),
    deleteDisposableState: vi.fn().mockResolvedValue({
      carts: 1,
      watchlistEntries: 1,
      notifications: 1,
    }),
    ...(overrides.accountLifecycle as object),
  };
  const sessions = {
    revokeAll: vi.fn().mockResolvedValue(undefined),
    ...(overrides.sessions as object),
  };
  const accountTokens = {
    invalidateActive: vi.fn().mockResolvedValue(0),
    ...(overrides.accountTokens as object),
  };
  const pendingEmailChanges = {
    deleteByUser: vi.fn().mockResolvedValue(true),
    ...(overrides.pendingEmailChanges as object),
  };
  const audits = {
    appendMany: vi.fn().mockResolvedValue(undefined),
    ...(overrides.audits as object),
  };
  const repositories = {
    users,
    accountLifecycle,
    sessions,
    accountTokens,
    pendingEmailChanges,
    audits,
  };
  const transactions = {
    run: vi.fn((work) => work(repositories as never)),
  } as unknown as CheckoutTransactionCoordinator;
  const comparePassword = vi.fn().mockResolvedValue(true);
  const hashPassword = vi.fn().mockResolvedValue('unusable-password-hash');
  const service = createAccountDeactivationService(transactions, {
    comparePassword,
    hashPassword,
  });
  return {
    ...service,
    users,
    accountLifecycle,
    sessions,
    accountTokens,
    pendingEmailChanges,
    audits,
    transactions,
    comparePassword,
    hashPassword,
  };
}

describe('accountDeactivationService', () => {
  it('deactivates and removes access and disposable state atomically', async () => {
    const test = harness();

    await test.deactivateAccount(body, user._id, 'mercadozetta', now);

    expect(test.comparePassword).toHaveBeenCalledWith(
      ' current secret ',
      user.passwordHash,
    );
    expect(test.hashPassword).toHaveBeenCalledWith(expect.any(String));
    expect(test.users.deactivateAccount).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      userId: user._id,
      expectedPasswordHash: user.passwordHash,
      expectedTokenVersion: user.tokenVersion,
      passwordHash: 'unusable-password-hash',
      now,
    });
    expect(test.sessions.revokeAll).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'account_deactivated',
      now,
    );
    expect(test.accountTokens.invalidateActive).toHaveBeenCalledTimes(3);
    expect(
      test.accountTokens.invalidateActive.mock.calls.map((call) => call[2]),
    ).toEqual(['email_verification', 'password_reset', 'email_change']);
    expect(test.pendingEmailChanges.deleteByUser).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
    );
    expect(test.accountLifecycle.archiveOwnedListings).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      now,
    );
    expect(test.accountLifecycle.deleteDisposableState).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
    );
    expect(test.audits.appendMany).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: 'user.deactivated',
        actorId: user._id,
        metadata: { archivedListingCount: 2 },
      }),
      expect.objectContaining({
        eventType: 'session.revoked',
        metadata: { reason: 'account_deactivated' },
      }),
    ]);
    const auditPayload = JSON.stringify(test.audits.appendMany.mock.calls);
    expect(auditPayload).not.toContain('current secret');
    expect(auditPayload).not.toContain('password-hash');
    expect(auditPayload).not.toContain(user.email);
  });

  it('blocks buyer or seller accounts with active orders before mutation', async () => {
    const test = harness({
      accountLifecycle: { hasActiveOrders: vi.fn().mockResolvedValue(true) },
    });

    await expect(test.deactivateAccount(body, user._id)).rejects.toMatchObject({
      code: 'ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS',
      statusCode: 409,
    });
    expect(test.users.deactivateAccount).not.toHaveBeenCalled();
    expect(test.sessions.revokeAll).not.toHaveBeenCalled();
    expect(test.audits.appendMany).not.toHaveBeenCalled();
  });

  it('uses the stable reauthentication error for absent or incorrect passwords', async () => {
    const absent = harness();
    await expect(
      absent.deactivateAccount(
        { currentPassword: '', confirmation: 'DEACTIVATE' },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'REAUTHENTICATION_FAILED' });
    expect(absent.comparePassword).not.toHaveBeenCalled();

    const incorrect = harness();
    incorrect.comparePassword.mockResolvedValue(false);
    await expect(
      incorrect.deactivateAccount(body, user._id),
    ).rejects.toMatchObject({ code: 'REAUTHENTICATION_FAILED' });
    expect(incorrect.hashPassword).not.toHaveBeenCalled();
  });

  it('rejects unavailable, deactivated, and stale account state', async () => {
    for (const snapshot of [null, { ...user, deactivatedAt: now }]) {
      const test = harness({
        users: { findAccountSecurityById: vi.fn().mockResolvedValue(snapshot) },
      });
      await expect(
        test.deactivateAccount(body, user._id),
      ).rejects.toMatchObject({ code: 'ACCOUNT_STATE_CHANGED' });
      expect(test.comparePassword).not.toHaveBeenCalled();
    }

    const stale = harness({
      users: {
        findAccountSecurityByIdForUpdate: vi.fn().mockResolvedValue({
          ...user,
          tokenVersion: user.tokenVersion + 1,
        }),
      },
    });
    await expect(stale.deactivateAccount(body, user._id)).rejects.toMatchObject(
      { code: 'ACCOUNT_STATE_CHANGED' },
    );
    expect(stale.users.deactivateAccount).not.toHaveBeenCalled();
  });

  it('validates confirmation before reading or hashing account state', async () => {
    const test = harness();
    await expect(
      test.deactivateAccount(
        { currentPassword: 'secret', confirmation: 'delete' },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'DEACTIVATION_CONFIRMATION_MISMATCH' });
    expect(test.transactions.run).not.toHaveBeenCalled();
    expect(test.hashPassword).not.toHaveBeenCalled();
  });
});
