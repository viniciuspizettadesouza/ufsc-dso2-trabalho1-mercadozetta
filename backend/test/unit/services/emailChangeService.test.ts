import { describe, expect, it, vi } from 'vitest';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { DuplicatePendingEmailError } from '@/repositories/pendingEmailChangeRepository';
import { DuplicateUserEmailError } from '@/repositories/userRepository';
import type { AccountMessage } from '@/services/accountMessageSender';
import {
  createEmailChangeService,
  EMAIL_CHANGE_REQUEST_RESPONSE,
} from '@/services/emailChangeService';
import { createAccountToken } from '@/services/accountTokenSecurityService';

class CapturingSender {
  messages: AccountMessage[] = [];
  failure?: Error;

  async enqueue(message: AccountMessage) {
    if (this.failure) throw this.failure;
    this.messages.push(message);
  }
}

const now = new Date('2026-07-19T12:00:00.000Z');
const user = {
  _id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  email: 'buyer@example.com',
  emailVerifiedAt: now,
  emailVersion: 4,
  passwordHash: 'current-password-hash',
  tokenVersion: 7,
  deactivatedAt: null,
};
const ring = {
  activeVersion: 'current',
  keys: { current: 'current-account-token-secret' },
};
const config = {
  emailVerificationTokenTtlMs: 8 * 60 * 60 * 1000,
  emailChangeTokenTtlMs: 30 * 60 * 1000,
  passwordResetTokenTtlMs: 30 * 60 * 1000,
  requestResponseFloorMs: 500,
  issueCooldownMs: 60 * 1000,
  issueWindowMs: 60 * 60 * 1000,
  issueMax: 3,
};

function harness(overrides: Record<string, unknown> = {}) {
  const users = {
    findAccountSecurityById: vi.fn().mockResolvedValue(user),
    findAccountSecurityByIdForUpdate: vi.fn().mockResolvedValue(user),
    emailExists: vi.fn().mockResolvedValue(false),
    promoteAccountEmail: vi.fn().mockResolvedValue(true),
    ...(overrides.users as object),
  };
  const accountTokens = {
    create: vi.fn().mockImplementation(async (token) => token),
    findById: vi.fn().mockResolvedValue(null),
    consume: vi.fn().mockResolvedValue(null),
    invalidateActive: vi.fn().mockResolvedValue(0),
    ...(overrides.accountTokens as object),
  };
  const pendingEmailChanges = {
    save: vi.fn().mockImplementation(async (change) => change),
    findByUserForUpdate: vi.fn().mockResolvedValue(null),
    deleteByUser: vi.fn().mockResolvedValue(true),
    ...(overrides.pendingEmailChanges as object),
  };
  const sessions = {
    revokeAll: vi.fn().mockResolvedValue(undefined),
    ...(overrides.sessions as object),
  };
  const audits = {
    append: vi.fn().mockResolvedValue(undefined),
    appendMany: vi.fn().mockResolvedValue(undefined),
    ...(overrides.audits as object),
  };
  const repositories = {
    users,
    accountTokens,
    pendingEmailChanges,
    sessions,
    audits,
  };
  const transactions = {
    run: vi.fn((work) => work(repositories as never)),
  } as unknown as CheckoutTransactionCoordinator;
  const sender = new CapturingSender();
  const comparePassword = vi.fn().mockResolvedValue(true);
  const service = createEmailChangeService(transactions, sender, {
    comparePassword,
    config: () => config,
    keyRing: () => ring,
  });

  return {
    ...service,
    users,
    accountTokens,
    pendingEmailChanges,
    sessions,
    audits,
    transactions,
    sender,
    comparePassword,
  };
}

async function flushDispatch() {
  await new Promise((resolve) => setImmediate(resolve));
}

function confirmationHarness(overrides: Record<string, unknown> = {}) {
  const generated = createAccountToken('mercadozetta', 'email_change', ring);
  const pending = {
    _id: '607f1f77-bcf8-4ecd-8994-390110000001',
    tenantId: 'mercadozetta',
    userId: user._id,
    email: 'replacement@example.com',
    emailVersion: user.emailVersion,
    expiresAt: new Date(now.getTime() + config.emailChangeTokenTtlMs),
    createdAt: now,
  };
  const record = {
    _id: generated.selector,
    tenantId: 'mercadozetta',
    userId: user._id,
    purpose: 'email_change' as const,
    tokenHash: generated.tokenHash,
    tokenHashSecretVersion: generated.tokenHashSecretVersion,
    emailVersion: user.emailVersion,
    expiresAt: pending.expiresAt,
    createdAt: now,
  };
  const test = harness({
    ...overrides,
    accountTokens: {
      findById: vi.fn().mockResolvedValue(record),
      consume: vi.fn().mockResolvedValue(record),
      ...(overrides.accountTokens as object),
    },
    pendingEmailChanges: {
      findByUserForUpdate: vi.fn().mockResolvedValue(pending),
      ...(overrides.pendingEmailChanges as object),
    },
  });
  return { ...test, generated, record, pending };
}

describe('emailChangeService', () => {
  it('atomically replaces pending state and dispatches only the raw token', async () => {
    const test = harness();

    await expect(
      test.requestEmailChange(
        {
          email: '  Replacement@Example.COM ',
          currentPassword: ' current secret ',
        },
        user._id,
        'mercadozetta',
        now,
      ),
    ).resolves.toEqual(EMAIL_CHANGE_REQUEST_RESPONSE);
    await flushDispatch();

    expect(test.comparePassword).toHaveBeenCalledWith(
      ' current secret ',
      user.passwordHash,
    );
    expect(test.accountTokens.invalidateActive).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'email_change',
      'replaced',
      now,
    );
    expect(test.pendingEmailChanges.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'mercadozetta',
        userId: user._id,
        email: 'replacement@example.com',
        emailVersion: user.emailVersion,
      }),
    );
    const storedToken = test.accountTokens.create.mock.calls[0][0];
    expect(storedToken).not.toHaveProperty('token');
    expect(test.sender.messages).toEqual([
      expect.objectContaining({
        kind: 'email_change',
        email: 'replacement@example.com',
        token: expect.any(String),
      }),
    ]);
    expect(test.audits.append).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      eventType: 'user.email_change_requested',
      actorId: user._id,
      resourceType: 'user',
      resourceId: user._id,
      occurredAt: now,
    });
  });

  it('requires changed, available state and successful reauthentication', async () => {
    await expect(
      harness().requestEmailChange(
        { email: 'BUYER@example.com', currentPassword: 'secret' },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_UNCHANGED' });
    await expect(
      harness({
        users: { emailExists: vi.fn().mockResolvedValue(true) },
      }).requestEmailChange(
        { email: 'other@example.com', currentPassword: 'secret' },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
    const failedAuth = harness();
    failedAuth.comparePassword.mockResolvedValue(false);
    await expect(
      failedAuth.requestEmailChange(
        { email: 'other@example.com', currentPassword: 'wrong' },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'REAUTHENTICATION_FAILED' });
  });

  it('maps pending-email races and ignores delivery failures after commit', async () => {
    const collision = harness({
      pendingEmailChanges: {
        save: vi.fn().mockRejectedValue(new DuplicatePendingEmailError()),
      },
    });
    await expect(
      collision.requestEmailChange(
        { email: 'other@example.com', currentPassword: 'secret' },
        user._id,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });

    const deliveryFailure = harness();
    deliveryFailure.sender.failure = new Error('provider unavailable');
    await expect(
      deliveryFailure.requestEmailChange(
        { email: 'other@example.com', currentPassword: 'secret' },
        user._id,
      ),
    ).resolves.toEqual(EMAIL_CHANGE_REQUEST_RESPONSE);
    await flushDispatch();
    expect(deliveryFailure.audits.append).toHaveBeenCalledOnce();
  });

  it('promotes the pending email, revokes sessions and invalidates peer tokens', async () => {
    const test = confirmationHarness();

    await test.confirmEmailChange(
      { token: test.generated.token },
      'mercadozetta',
      now,
    );

    expect(test.accountTokens.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'mercadozetta',
        purpose: 'email_change',
        emailVersion: user.emailVersion,
      }),
    );
    expect(test.users.promoteAccountEmail).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      userId: user._id,
      expectedEmailVersion: user.emailVersion,
      email: test.pending.email,
      now,
    });
    expect(test.pendingEmailChanges.deleteByUser).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
    );
    expect(test.sessions.revokeAll).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'email_changed',
      now,
    );
    expect(test.accountTokens.invalidateActive).toHaveBeenCalledTimes(3);
    expect(test.audits.appendMany).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: 'user.email_changed',
        resourceId: user._id,
      }),
      expect.objectContaining({
        eventType: 'session.revoked',
        metadata: { reason: 'email_changed' },
      }),
    ]);
    expect(test.audits.appendMany.mock.calls[0][0][0]).not.toHaveProperty(
      'actorId',
    );
  });

  it('uses one generic error for malformed, cross-tenant and stale confirmation state', async () => {
    await expect(
      harness().confirmEmailChange({ token: 'malformed' }),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });

    const crossTenant = confirmationHarness();
    await expect(
      crossTenant.confirmEmailChange(
        { token: crossTenant.generated.token },
        'campusmarket',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });

    const stale = confirmationHarness({
      users: {
        findAccountSecurityByIdForUpdate: vi.fn().mockResolvedValue({
          ...user,
          emailVersion: user.emailVersion + 1,
        }),
      },
    });
    await expect(
      stale.confirmEmailChange(
        { token: stale.generated.token },
        'mercadozetta',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });
    expect(stale.accountTokens.consume).not.toHaveBeenCalled();
  });

  it('rolls uniqueness conflicts into a stable availability error', async () => {
    const test = confirmationHarness({
      users: {
        promoteAccountEmail: vi
          .fn()
          .mockRejectedValue(new DuplicateUserEmailError()),
      },
    });

    await expect(
      test.confirmEmailChange(
        { token: test.generated.token },
        'mercadozetta',
        now,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
  });
});
