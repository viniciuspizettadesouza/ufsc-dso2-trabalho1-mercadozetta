import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type {
  SessionRecord,
  SessionRepository,
} from '@/repositories/sessionRepository';
import {
  createRefreshToken,
  hashRefreshTokenWithActiveKey,
} from '@/services/sessionSecurityService';
import { createSessionService } from '@/services/sessionService';

const now = new Date('2026-07-19T15:00:00.000Z');
const tenantId = 'mercadozetta';
const userId = '507f1f77-bcf8-4ecd-8994-390110000001';
const sessionId = '507f191e-810c-4197-9de8-60ea00000001';

function sessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    _id: sessionId,
    tenantId,
    userId,
    familyId: '507f191e-810c-4197-9de8-60ea00000002',
    tokenVersion: 3,
    refreshTokenHash: 'current-hash',
    refreshTokenSecretVersion: 'local',
    rotationCounter: 0,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    absoluteExpiresAt: new Date(now.getTime() + 120_000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(overrides: Partial<SessionRepository> = {}) {
  return {
    create: vi.fn(async (record: SessionRecord) => record),
    findRefreshById: vi.fn().mockResolvedValue(null),
    rotateCurrent: vi.fn().mockResolvedValue(true),
    revokeById: vi.fn().mockResolvedValue(undefined),
    findOwned: vi.fn().mockResolvedValue(null),
    listActive: vi.fn().mockResolvedValue([]),
    revokeOwned: vi.fn().mockResolvedValue(true),
    revokeAll: vi.fn().mockResolvedValue(undefined),
    isActive: vi.fn().mockResolvedValue(true),
    deleteExpired: vi.fn().mockResolvedValue(0),
    ...overrides,
  } satisfies SessionRepository;
}

function harness(
  options: {
    sessions?: SessionRepository;
    tokenVersion?: number | null;
  } = {},
) {
  const sessions = options.sessions ?? repository();
  const users = {
    findTokenVersion: vi.fn().mockResolvedValue(options.tokenVersion ?? 3),
  };
  const audits = {
    append: vi.fn().mockResolvedValue(undefined),
    appendMany: vi.fn().mockResolvedValue(undefined),
  };
  const transactions = {
    run: vi.fn((work) => work({ sessions, users, audits } as never)),
  } as unknown as CheckoutTransactionCoordinator;

  return {
    ...createSessionService(sessions, transactions),
    sessions,
    users,
    audits,
    transactions,
  };
}

describe('sessionService', () => {
  it('creates a sanitized session, audit, and bound credentials atomically', async () => {
    const test = harness();

    const result = await test.createSession(
      userId,
      tenantId,
      3,
      ' Browser\r\nLabel '.repeat(12),
      now,
    );

    expect(test.transactions.run).toHaveBeenCalledTimes(1);
    expect(test.sessions.create).toHaveBeenCalledTimes(1);
    const created = vi.mocked(test.sessions.create).mock.calls[0][0];
    expect(created).toMatchObject({
      tenantId,
      userId,
      tokenVersion: 3,
      rotationCounter: 0,
      lastUsedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(created._id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(created.familyId).not.toBe(created._id);
    expect(created.userAgentLabel).not.toMatch(/[\r\n]/);
    expect(created.userAgentLabel).toHaveLength(120);
    expect(result.refreshToken.startsWith(`${created._id}.`)).toBe(true);
    expect(result.csrfToken.split('.')).toHaveLength(3);
    expect(jwt.decode(result.accessToken)).toMatchObject({
      sub: userId,
      tenantId,
      sid: created._id,
      tokenVersion: 3,
      typ: 'access',
      iss: 'mercadozetta',
      aud: 'mercadozetta-api',
    });
    expect(result.session).toEqual({
      id: created._id,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: created.expiresAt,
      absoluteExpiresAt: created.absoluteExpiresAt,
      userAgentLabel: created.userAgentLabel,
    });
    expect(test.audits.append).toHaveBeenCalledWith({
      tenantId,
      eventType: 'session.created',
      actorId: userId,
      resourceType: 'session',
      resourceId: created._id,
      occurredAt: now,
    });
  });

  it('rotates the current refresh token and records the next counter', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const currentHash = hashRefreshTokenWithActiveKey(refreshToken);
    const current = sessionRecord({
      refreshTokenHash: currentHash.hash,
      refreshTokenSecretVersion: currentHash.version,
    });
    const sessions = repository({
      findRefreshById: vi.fn().mockResolvedValue(current),
    });
    const test = harness({ sessions });

    const result = await test.rotateSession(refreshToken, tenantId, now);

    expect(test.users.findTokenVersion).toHaveBeenCalledWith(tenantId, userId);
    expect(test.sessions.rotateCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sessionId,
        expectedRefreshTokenHash: currentHash.hash,
        previousRefreshTokenSecretVersion: currentHash.version,
        nextRefreshTokenSecretVersion: currentHash.version,
        now,
      }),
    );
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.session.id).toBe(sessionId);
    expect(test.audits.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.rotated',
        metadata: { rotationCounter: 1 },
      }),
    );
  });

  it('rejects malformed, unknown, and expired refresh sessions', async () => {
    const malformed = harness();
    await expect(
      malformed.rotateSession('invalid', tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(malformed.sessions.findRefreshById).not.toHaveBeenCalled();

    const refreshToken = createRefreshToken(sessionId);
    const unknown = harness();
    await expect(
      unknown.rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    const expired = harness({
      sessions: repository({
        findRefreshById: vi
          .fn()
          .mockResolvedValue(sessionRecord({ expiresAt: now })),
      }),
    });
    await expect(
      expired.rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('revokes a session whose persisted user token version changed', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const currentHash = hashRefreshTokenWithActiveKey(refreshToken);
    const sessions = repository({
      findRefreshById: vi.fn().mockResolvedValue(
        sessionRecord({
          refreshTokenHash: currentHash.hash,
          refreshTokenSecretVersion: currentHash.version,
        }),
      ),
    });
    const test = harness({ sessions, tokenVersion: 4 });

    await expect(
      test.rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(test.sessions.revokeById).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      'invalid_user_session',
      now,
    );
    expect(test.audits.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.revoked',
        metadata: { reason: 'invalid_user_session' },
      }),
    );
  });

  it('returns the bounded concurrency response for a recently rotated token', async () => {
    const previousToken = createRefreshToken(sessionId);
    const previousHash = hashRefreshTokenWithActiveKey(previousToken);
    const sessions = repository({
      findRefreshById: vi.fn().mockResolvedValue(
        sessionRecord({
          refreshTokenHash: 'different-current-hash',
          previousRefreshTokenHash: previousHash.hash,
          previousRefreshTokenSecretVersion: previousHash.version,
          rotatedAt: new Date(now.getTime() - 1000),
        }),
      ),
    });

    await expect(
      harness({ sessions }).rotateSession(previousToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'REFRESH_ALREADY_ROTATED' });
    expect(sessions.revokeById).not.toHaveBeenCalled();
  });

  it('revokes the family when a previous token is replayed after the window', async () => {
    const previousToken = createRefreshToken(sessionId);
    const previousHash = hashRefreshTokenWithActiveKey(previousToken);
    const sessions = repository({
      findRefreshById: vi.fn().mockResolvedValue(
        sessionRecord({
          refreshTokenHash: 'different-current-hash',
          previousRefreshTokenHash: previousHash.hash,
          previousRefreshTokenSecretVersion: previousHash.version,
          rotatedAt: new Date(now.getTime() - 60_000),
        }),
      ),
    });
    const test = harness({ sessions });

    await expect(
      test.rotateSession(previousToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });
    expect(test.sessions.revokeById).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      'refresh_reuse',
      now,
    );
    expect(test.audits.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.reuse_detected',
        metadata: { reason: 'refresh_reuse' },
      }),
    );
  });

  it('classifies a lost rotation race using the reloaded session', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const currentHash = hashRefreshTokenWithActiveKey(refreshToken);
    const current = sessionRecord({
      refreshTokenHash: currentHash.hash,
      refreshTokenSecretVersion: currentHash.version,
    });
    const reloaded = sessionRecord({
      refreshTokenHash: 'winner-hash',
      previousRefreshTokenHash: currentHash.hash,
      previousRefreshTokenSecretVersion: currentHash.version,
      rotatedAt: now,
    });
    const sessions = repository({
      findRefreshById: vi
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(reloaded),
      rotateCurrent: vi.fn().mockResolvedValue(false),
    });

    await expect(
      harness({ sessions }).rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'REFRESH_ALREADY_ROTATED' });
    expect(sessions.findRefreshById).toHaveBeenCalledTimes(2);
  });

  it('rejects a token that matches neither current nor previous hashes', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const sessions = repository({
      findRefreshById: vi.fn().mockResolvedValue(
        sessionRecord({
          refreshTokenHash: 'different-current-hash',
          previousRefreshTokenHash: 'different-previous-hash',
          previousRefreshTokenSecretVersion: 'local',
        }),
      ),
    });

    await expect(
      harness({ sessions }).rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('gets, lists, revokes, and deletes sessions through their repository boundaries', async () => {
    const active = sessionRecord({ userAgentLabel: 'Browser' });
    const sessions = repository({
      findOwned: vi.fn().mockResolvedValue(active),
      listActive: vi.fn().mockResolvedValue([active]),
      deleteExpired: vi.fn().mockResolvedValue(2),
    });
    const test = harness({ sessions });

    await expect(
      test.getSession(sessionId, userId, tenantId, now),
    ).resolves.toMatchObject({ id: sessionId, userAgentLabel: 'Browser' });
    await expect(test.listSessions(userId, tenantId, now)).resolves.toEqual([
      expect.objectContaining({ id: sessionId }),
    ]);
    await test.revokeSession(sessionId, userId, tenantId, 'user_logout', now);
    await test.revokeAllSessions(userId, tenantId, now);
    await expect(test.deleteExpiredSessions(now)).resolves.toBe(2);

    expect(test.sessions.revokeOwned).toHaveBeenCalledWith(
      tenantId,
      userId,
      sessionId,
      'user_logout',
      now,
    );
    expect(test.sessions.revokeAll).toHaveBeenCalledWith(
      tenantId,
      userId,
      'all_sessions_logout',
      now,
    );
    expect(test.audits.append.mock.calls).toEqual([
      [
        expect.objectContaining({
          eventType: 'session.revoked',
          resourceType: 'session',
          metadata: { reason: 'user_logout' },
        }),
      ],
      [
        expect.objectContaining({
          eventType: 'session.revoked',
          resourceType: 'user',
          metadata: { reason: 'all_sessions_logout' },
        }),
      ],
    ]);
  });

  it('rejects unavailable session reads and ownership-safe revocation misses', async () => {
    const test = harness({
      sessions: repository({ revokeOwned: vi.fn().mockResolvedValue(false) }),
    });

    await expect(
      test.getSession(sessionId, userId, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_AUTH_TOKEN' });
    await expect(
      test.revokeSession(sessionId, userId, tenantId, 'user_logout', now),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    expect(test.audits.append).not.toHaveBeenCalled();
  });
});
