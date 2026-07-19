import { describe, expect, it, vi } from 'vitest';
import type { AccountMessage } from '@/services/accountMessageSender';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import {
  createAccountSecurityService,
  GENERIC_ACCOUNT_REQUEST_RESPONSE,
} from '@/services/accountSecurityService';
import { createAccountToken } from '@/services/accountTokenSecurityService';

class CapturingAccountMessageSender {
  messages: AccountMessage[] = [];
  failure?: Error;

  async enqueue(message: AccountMessage) {
    if (this.failure) throw this.failure;
    this.messages.push(message);
  }
}

const now = new Date('2026-07-19T10:00:00.000Z');
const user = {
  _id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  email: 'buyer@example.com',
  emailVerifiedAt: null,
  emailVersion: 2,
  passwordHash: 'old-password-hash',
  tokenVersion: 3,
};
const ring = {
  activeVersion: 'current',
  keys: { current: 'current-secret', previous: 'previous-secret' },
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
  const accountTokens = {
    create: vi.fn().mockImplementation(async (token) => token),
    findById: vi.fn().mockResolvedValue(null),
    consume: vi.fn().mockResolvedValue(null),
    invalidateActive: vi.fn().mockResolvedValue(0),
    countIssuedSince: vi.fn().mockResolvedValue(0),
    findLatestIssuedAt: vi.fn().mockResolvedValue(null),
    deleteRetired: vi.fn().mockResolvedValue(0),
    ...(overrides.accountTokens as object),
  };
  const users = {
    findForAccountSecurityForUpdate: vi.fn().mockResolvedValue(user),
    findAccountSecurityById: vi.fn().mockResolvedValue(user),
    markEmailVerified: vi.fn().mockResolvedValue(true),
    replacePasswordAndIncrementTokenVersion: vi.fn().mockResolvedValue(true),
    ...(overrides.users as object),
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
  const repositories = { accountTokens, users, sessions, audits };
  const transactions = {
    run: vi.fn((work) => work(repositories as never)),
  } as unknown as CheckoutTransactionCoordinator;
  const sender = new CapturingAccountMessageSender();
  const hashPassword = vi.fn().mockResolvedValue('new-password-hash');
  const service = createAccountSecurityService(transactions, sender, {
    config: () => config,
    keyRing: () => ring,
    hashPassword,
  });
  return {
    ...service,
    accountTokens,
    users,
    sessions,
    audits,
    transactions,
    sender,
    hashPassword,
  };
}

async function flushDispatch() {
  await new Promise((resolve) => setImmediate(resolve));
}

function storedToken(purpose: 'email_verification' | 'password_reset') {
  const generated = createAccountToken('mercadozetta', purpose, ring);
  return {
    generated,
    record: {
      _id: generated.selector,
      tenantId: 'mercadozetta',
      userId: user._id,
      purpose,
      tokenHash: generated.tokenHash,
      tokenHashSecretVersion: generated.tokenHashSecretVersion,
      ...(purpose === 'email_verification'
        ? { emailVersion: user.emailVersion }
        : {}),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
    },
  };
}

describe('accountSecurityService requests', () => {
  it('replaces an active verification token and dispatches only the raw message', async () => {
    const service = harness();

    await expect(
      service.requestEmailVerification(
        { email: ' Buyer@Example.com ' },
        'mercadozetta',
        now,
      ),
    ).resolves.toEqual(GENERIC_ACCOUNT_REQUEST_RESPONSE);
    await flushDispatch();

    expect(service.users.findForAccountSecurityForUpdate).toHaveBeenCalledWith(
      'mercadozetta',
      'buyer@example.com',
    );
    expect(service.accountTokens.invalidateActive).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'email_verification',
      'replaced',
      now,
    );
    const persisted = service.accountTokens.create.mock.calls[0][0];
    expect(persisted).toMatchObject({
      purpose: 'email_verification',
      emailVersion: 2,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: new Date('2026-07-19T18:00:00.000Z'),
    });
    expect(persisted).not.toHaveProperty('token');
    expect(service.sender.messages).toEqual([
      expect.objectContaining({
        kind: 'email_verification',
        email: 'buyer@example.com',
        token: expect.stringMatching(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/),
      }),
    ]);
  });

  it('creates reset tokens without treating reset as email verification', async () => {
    const service = harness();
    await expect(
      service.requestPasswordReset({ email: user.email }, 'mercadozetta', now),
    ).resolves.toEqual(GENERIC_ACCOUNT_REQUEST_RESPONSE);
    await flushDispatch();

    expect(service.accountTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'password_reset',
        expiresAt: new Date('2026-07-19T10:30:00.000Z'),
      }),
    );
    expect(service.accountTokens.create.mock.calls[0][0]).not.toHaveProperty(
      'emailVersion',
    );
    expect(service.sender.messages[0]).toMatchObject({
      kind: 'password_reset',
    });
  });

  it('returns one response for absent, verified, cooldown, and hourly-limit states', async () => {
    const variants = [
      harness({
        users: {
          findForAccountSecurityForUpdate: vi.fn().mockResolvedValue(null),
        },
      }),
      harness({
        users: {
          findForAccountSecurityForUpdate: vi
            .fn()
            .mockResolvedValue({ ...user, emailVerifiedAt: now }),
        },
      }),
      harness({
        accountTokens: {
          findLatestIssuedAt: vi
            .fn()
            .mockResolvedValue(new Date(now.getTime() - 30_000)),
        },
      }),
      harness({
        accountTokens: {
          countIssuedSince: vi.fn().mockResolvedValue(3),
        },
      }),
    ];

    for (const service of variants) {
      await expect(
        service.requestEmailVerification(
          { email: user.email },
          'mercadozetta',
          now,
        ),
      ).resolves.toEqual(GENERIC_ACCOUNT_REQUEST_RESPONSE);
      expect(service.accountTokens.create).not.toHaveBeenCalled();
      expect(service.sender.messages).toEqual([]);
    }
  });

  it('keeps delivery-adapter failure out of the public request result', async () => {
    const service = harness();
    service.sender.failure = new Error('provider unavailable');

    await expect(
      service.requestPasswordReset({ email: user.email }, 'mercadozetta', now),
    ).resolves.toEqual(GENERIC_ACCOUNT_REQUEST_RESPONSE);
    await flushDispatch();
    expect(service.sender.messages).toEqual([]);
  });
});

describe('accountSecurityService confirmations', () => {
  it('consumes verification once, binds the email version, and audits success', async () => {
    const { generated, record } = storedToken('email_verification');
    const service = harness({
      accountTokens: {
        findById: vi.fn().mockResolvedValue(record),
        consume: vi.fn().mockResolvedValue({ ...record, consumedAt: now }),
      },
    });

    await expect(
      service.confirmEmailVerification(
        { token: generated.token },
        'mercadozetta',
        now,
      ),
    ).resolves.toBeUndefined();
    expect(service.accountTokens.consume).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      tokenId: generated.selector,
      purpose: 'email_verification',
      tokenHash: record.tokenHash,
      emailVersion: 2,
      now,
    });
    expect(service.users.markEmailVerified).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      2,
      now,
    );
    expect(service.audits.append).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      eventType: 'user.email_verified',
      resourceType: 'user',
      resourceId: user._id,
      occurredAt: now,
    });
  });

  it('uses one generic error for malformed, wrong-purpose, and lost-race tokens', async () => {
    const malformed = harness();
    await expect(
      malformed.confirmEmailVerification(
        { token: 'malformed' },
        'mercadozetta',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });
    expect(malformed.transactions.run).not.toHaveBeenCalled();

    const { generated, record } = storedToken('password_reset');
    const wrongPurpose = harness({
      accountTokens: { findById: vi.fn().mockResolvedValue(record) },
    });
    await expect(
      wrongPurpose.confirmEmailVerification(
        { token: generated.token },
        'mercadozetta',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });

    const verification = storedToken('email_verification');
    const lostRace = harness({
      accountTokens: {
        findById: vi.fn().mockResolvedValue(verification.record),
        consume: vi.fn().mockResolvedValue(null),
      },
    });
    await expect(
      lostRace.confirmEmailVerification(
        { token: verification.generated.token },
        'mercadozetta',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });
    expect(lostRace.audits.append).not.toHaveBeenCalled();
  });

  it('resets credentials, revokes sessions, invalidates peers, and audits atomically', async () => {
    const { generated, record } = storedToken('password_reset');
    const service = harness({
      accountTokens: {
        findById: vi.fn().mockResolvedValue(record),
        consume: vi.fn().mockResolvedValue({ ...record, consumedAt: now }),
      },
    });

    await expect(
      service.confirmPasswordReset(
        {
          token: generated.token,
          password: 'new-secret-123',
          passwordConfirmation: 'new-secret-123',
        },
        'mercadozetta',
        now,
      ),
    ).resolves.toBeUndefined();
    await flushDispatch();

    expect(service.hashPassword).toHaveBeenCalledWith('new-secret-123');
    expect(
      service.users.replacePasswordAndIncrementTokenVersion,
    ).toHaveBeenCalledWith('mercadozetta', user._id, 'new-password-hash', now);
    expect(service.sessions.revokeAll).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'password_reset',
      now,
    );
    expect(service.accountTokens.invalidateActive).toHaveBeenCalledWith(
      'mercadozetta',
      user._id,
      'password_reset',
      'password_reset',
      now,
      generated.selector,
    );
    expect(service.audits.appendMany).toHaveBeenCalledWith([
      expect.objectContaining({ eventType: 'user.password_reset' }),
      expect.objectContaining({
        eventType: 'session.revoked',
        metadata: { reason: 'password_reset' },
      }),
    ]);
    expect(service.sender.messages).toEqual([
      {
        kind: 'password_reset_notice',
        tenantId: 'mercadozetta',
        userId: user._id,
        email: user.email,
        occurredAt: now,
      },
    ]);
  });

  it('validates password policy before hashing or opening a transaction', async () => {
    const service = harness();
    await expect(
      service.confirmPasswordReset(
        {
          token: 'opaque',
          password: 'short',
          passwordConfirmation: 'short',
        },
        'mercadozetta',
        now,
      ),
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(service.hashPassword).not.toHaveBeenCalled();
    expect(service.transactions.run).not.toHaveBeenCalled();
  });
});
