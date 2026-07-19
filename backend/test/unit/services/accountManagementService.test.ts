import { describe, expect, it, vi } from 'vitest';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { createAccountManagementService } from '@/services/accountManagementService';

const now = new Date('2026-07-19T14:00:00.000Z');
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
const publicUser = {
  _id: user._id,
  tenantId: user.tenantId,
  email: user.email,
  username: 'Updated Seller',
  telephone: null,
};

function harness(overrides: Record<string, unknown> = {}) {
  const users = {
    findAccountSecurityById: vi.fn().mockResolvedValue(user),
    findPublicById: vi.fn().mockResolvedValue({
      ...publicUser,
      username: 'Original Seller',
      telephone: '123',
    }),
    updateProfile: vi.fn().mockResolvedValue(publicUser),
    replaceAccountPassword: vi.fn().mockResolvedValue(true),
    ...(overrides.users as object),
  };
  const sessions = {
    revokeAll: vi.fn().mockResolvedValue(undefined),
    ...(overrides.sessions as object),
  };
  const accountTokens = {
    invalidateActive: vi.fn().mockResolvedValue(0),
    ...(overrides.accountTokens as object),
  };
  const audits = {
    append: vi.fn().mockResolvedValue(undefined),
    appendMany: vi.fn().mockResolvedValue(undefined),
    ...(overrides.audits as object),
  };
  const repositories = { users, sessions, accountTokens, audits };
  const transactions = {
    run: vi.fn((work) => work(repositories as never)),
  } as unknown as CheckoutTransactionCoordinator;
  const comparePassword = vi
    .fn()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  const hashPassword = vi.fn().mockResolvedValue('replacement-password-hash');
  const service = createAccountManagementService(transactions, {
    comparePassword,
    hashPassword,
  });
  return {
    ...service,
    users,
    sessions,
    accountTokens,
    audits,
    transactions,
    comparePassword,
    hashPassword,
  };
}

const passwordBody = {
  currentPassword: 'current-secret',
  password: 'replacement-secret',
  passwordConfirmation: 'replacement-secret',
};

describe('accountManagementService', () => {
  it('updates explicit profile fields and audits names without values', async () => {
    const service = harness();

    await expect(
      service.updateProfile(
        { username: ' Updated Seller ', telephone: null },
        user._id,
        'mercadozetta',
        now,
      ),
    ).resolves.toEqual(publicUser);

    expect(service.users.updateProfile).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      { username: 'Updated Seller', telephone: null },
      now,
    );
    expect(service.audits.append).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      eventType: 'user.profile_updated',
      actorId: user._id,
      resourceType: 'user',
      resourceId: user._id,
      metadata: { changedFields: 'username,telephone' },
      occurredAt: now,
    });
    expect(JSON.stringify(service.audits.append.mock.calls)).not.toContain(
      'Updated Seller',
    );
  });

  it('rejects missing profile state and validates before a transaction', async () => {
    const missing = harness({
      users: { findPublicById: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      missing.updateProfile({ username: 'seller' }, user._id),
    ).rejects.toMatchObject({ code: 'ACCOUNT_STATE_CHANGED', statusCode: 409 });
    expect(missing.audits.append).not.toHaveBeenCalled();

    const invalid = harness();
    await expect(
      invalid.updateProfile({ email: 'other@example.com' } as never, user._id),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(invalid.transactions.run).not.toHaveBeenCalled();
  });

  it('returns unchanged profile state without an audit write', async () => {
    const service = harness({
      users: { findPublicById: vi.fn().mockResolvedValue(publicUser) },
    });

    await expect(
      service.updateProfile(
        { username: publicUser.username, telephone: null },
        user._id,
      ),
    ).resolves.toEqual(publicUser);
    expect(service.users.updateProfile).not.toHaveBeenCalled();
    expect(service.audits.append).not.toHaveBeenCalled();
  });

  it('changes a reauthenticated password and revokes credentials atomically', async () => {
    const service = harness();

    await expect(
      service.changePassword(passwordBody, user._id, 'mercadozetta', now),
    ).resolves.toBeUndefined();

    expect(service.comparePassword).toHaveBeenNthCalledWith(
      1,
      'current-secret',
      user.passwordHash,
    );
    expect(service.comparePassword).toHaveBeenNthCalledWith(
      2,
      'replacement-secret',
      user.passwordHash,
    );
    expect(service.hashPassword).toHaveBeenCalledWith('replacement-secret');
    expect(service.users.replaceAccountPassword).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      userId: user._id,
      expectedPasswordHash: user.passwordHash,
      expectedTokenVersion: 3,
      passwordHash: 'replacement-password-hash',
      now,
    });
    expect(service.sessions.revokeAll).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'password_change',
      now,
    );
    expect(service.accountTokens.invalidateActive).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'password_reset',
      'password_change',
      now,
    );
    expect(service.audits.appendMany).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: 'user.password_changed',
        actorId: user._id,
      }),
      expect.objectContaining({
        eventType: 'session.revoked',
        metadata: { reason: 'password_change' },
      }),
    ]);
    const auditPayload = JSON.stringify(service.audits.appendMany.mock.calls);
    expect(auditPayload).not.toContain('current-secret');
    expect(auditPayload).not.toContain('replacement-secret');
    expect(auditPayload).not.toContain('password-hash');
    expect(service.transactions.run).toHaveBeenCalledTimes(2);
  });

  it('rejects failed reauthentication and password reuse before hashing', async () => {
    const failed = harness();
    failed.comparePassword.mockReset().mockResolvedValue(false);
    await expect(
      failed.changePassword(passwordBody, user._id),
    ).rejects.toMatchObject({
      code: 'REAUTHENTICATION_FAILED',
      statusCode: 403,
    });
    expect(failed.hashPassword).not.toHaveBeenCalled();
    expect(failed.users.replaceAccountPassword).not.toHaveBeenCalled();

    const reused = harness();
    reused.comparePassword.mockReset().mockResolvedValue(true);
    await expect(
      reused.changePassword(passwordBody, user._id),
    ).rejects.toMatchObject({
      code: 'PASSWORD_REUSE_NOT_ALLOWED',
      statusCode: 400,
    });
    expect(reused.hashPassword).not.toHaveBeenCalled();
    expect(reused.users.replaceAccountPassword).not.toHaveBeenCalled();
  });

  it('rejects unavailable, deactivated, and stale account snapshots', async () => {
    for (const snapshot of [null, { ...user, deactivatedAt: now }]) {
      const service = harness({
        users: { findAccountSecurityById: vi.fn().mockResolvedValue(snapshot) },
      });
      await expect(
        service.changePassword(passwordBody, user._id),
      ).rejects.toMatchObject({ code: 'ACCOUNT_STATE_CHANGED' });
      expect(service.comparePassword).not.toHaveBeenCalled();
    }

    const stale = harness({
      users: { replaceAccountPassword: vi.fn().mockResolvedValue(false) },
    });
    await expect(
      stale.changePassword(passwordBody, user._id),
    ).rejects.toMatchObject({ code: 'ACCOUNT_STATE_CHANGED' });
    expect(stale.sessions.revokeAll).not.toHaveBeenCalled();
    expect(stale.accountTokens.invalidateActive).not.toHaveBeenCalled();
    expect(stale.audits.appendMany).not.toHaveBeenCalled();
  });

  it('validates password input before reading account state', async () => {
    const service = harness();
    await expect(
      service.changePassword(
        {
          currentPassword: 'current-secret',
          password: 'short',
          passwordConfirmation: 'short',
        },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(service.transactions.run).not.toHaveBeenCalled();
  });
});
