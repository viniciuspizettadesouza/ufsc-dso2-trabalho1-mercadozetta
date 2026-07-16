import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Session from '@/model/session';
import User from '@/model/user';
import {
  createSession,
  getSession,
  listSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from '@/services/sessionService';
import {
  createRefreshToken,
  hashRefreshToken,
} from '@/services/sessionSecurityService';

vi.mock('@/model/session', () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('@/model/user', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'cookie-access-token'),
  },
}));

const mockedSession = Session as typeof Session & {
  create: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
};
const mockedUser = User as typeof User & {
  findOne: ReturnType<typeof vi.fn>;
};
const mockedJwt = jwt as typeof jwt & { sign: ReturnType<typeof vi.fn> };

const sessionId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439010';
const tenantId = 'mercadozetta';
const now = new Date('2026-07-15T12:00:00.000Z');

function sessionDocument(overrides: Record<string, unknown> = {}) {
  const value: any = {
    _id: sessionId,
    tenantId,
    userId,
    familyId: 'family-1',
    tokenVersion: 2,
    refreshTokenHash: 'current-hash',
    refreshTokenSecretVersion: 'local',
    previousRefreshTokenSecretVersion: 'local',
    rotationCounter: 0,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date('2026-07-22T12:00:00.000Z'),
    absoluteExpiresAt: new Date('2026-08-14T12:00:00.000Z'),
    ...overrides,
  };
  value.toObject = () => ({ ...value, toObject: undefined });
  return value;
}

function queryResult(value: unknown) {
  return {
    select: vi.fn().mockResolvedValue(value),
    then(
      resolve: (result: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function activeUser(tokenVersion = 2) {
  return { _id: userId, tokenVersion };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedJwt.sign.mockReturnValue('cookie-access-token');
  mockedSession.updateOne.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1,
  });
  mockedSession.updateMany.mockResolvedValue({ modifiedCount: 1 });
  mockedUser.findOne.mockReturnValue(queryResult(activeUser()));
});

describe('session service', () => {
  it('creates a tenant-scoped session with hashes, bounded metadata, and cookie credentials', async () => {
    mockedSession.create.mockImplementation(
      async (input: Record<string, unknown>) => sessionDocument(input),
    );

    const result = await createSession(
      userId,
      tenantId,
      2,
      `${'Browser'.repeat(30)}\r\nInjected`,
      now,
    );
    const persisted = mockedSession.create.mock.calls[0][0];

    expect(persisted).toMatchObject({
      tenantId,
      userId,
      tokenVersion: 2,
      rotationCounter: 0,
      lastUsedAt: now,
      refreshTokenHash: expect.any(String),
      refreshTokenSecretVersion: 'local',
      familyId: expect.any(String),
      userAgentLabel: expect.not.stringContaining('\n'),
    });
    expect(persisted.userAgentLabel).toHaveLength(120);
    expect(persisted.refreshTokenHash).not.toBe(result.refreshToken);
    expect(result).toMatchObject({
      accessToken: 'cookie-access-token',
      refreshToken: expect.any(String),
      csrfToken: expect.any(String),
      session: { id: expect.stringMatching(/^[a-f\d]{24}$/) },
    });
    expect(mockedJwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sid: result.session.id,
        tokenVersion: 2,
        typ: 'access',
      }),
      expect.any(String),
      expect.objectContaining({
        subject: userId,
        expiresIn: 300,
        issuer: 'mercadozetta',
        audience: 'mercadozetta-api',
        keyid: 'local',
      }),
    );
  });

  it('rotates the current hash through an atomic compare-and-swap', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const currentHash = hashRefreshToken(refreshToken);
    const session = sessionDocument({ refreshTokenHash: currentHash });
    mockedSession.findOne.mockReturnValue(queryResult(session));

    const result = await rotateSession(refreshToken, tenantId, now);

    expect(mockedSession.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: sessionId,
        tenantId,
        refreshTokenHash: currentHash,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          previousRefreshTokenHash: currentHash,
          previousRefreshTokenSecretVersion: 'local',
          refreshTokenHash: expect.any(String),
          refreshTokenSecretVersion: 'local',
          rotatedAt: now,
        }),
        $inc: { rotationCounter: 1 },
      }),
    );
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.session.id).toBe(sessionId);
    expect(result.accessToken).toBe('cookie-access-token');
  });

  it('rejects malformed, unknown, expired, and revoked refresh sessions', async () => {
    await expect(
      rotateSession('malformed', tenantId, now),
    ).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });

    mockedSession.findOne.mockReturnValueOnce(queryResult(null));
    await expect(
      rotateSession(createRefreshToken(sessionId), tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    for (const session of [
      sessionDocument({ expiresAt: now }),
      sessionDocument({ absoluteExpiresAt: now }),
      sessionDocument({ revokedAt: now }),
    ]) {
      mockedSession.findOne.mockReturnValueOnce(queryResult(session));
      await expect(
        rotateSession(createRefreshToken(sessionId), tenantId, now),
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    }
  });

  it('revokes refresh capability when the user is missing or its token version changed', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const session = sessionDocument({
      refreshTokenHash: hashRefreshToken(refreshToken),
    });

    for (const user of [null, activeUser(3)]) {
      mockedSession.findOne.mockReturnValueOnce(queryResult(session));
      mockedUser.findOne.mockReturnValueOnce(queryResult(user));
      await expect(
        rotateSession(refreshToken, tenantId, now),
      ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    }

    expect(mockedSession.updateOne).toHaveBeenCalledWith(
      { _id: sessionId, tenantId },
      {
        $set: {
          revokedAt: now,
          revokeReason: 'invalid_user_session',
        },
      },
    );
  });

  it('returns a conflict for an immediate previous-token retry', async () => {
    const previousToken = createRefreshToken(sessionId);
    mockedSession.findOne.mockReturnValue(
      queryResult(
        sessionDocument({
          refreshTokenHash: hashRefreshToken(createRefreshToken(sessionId)),
          previousRefreshTokenHash: hashRefreshToken(previousToken),
          rotatedAt: new Date(now.getTime() - 1000),
        }),
      ),
    );

    await expect(
      rotateSession(previousToken, tenantId, now),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'REFRESH_ALREADY_ROTATED',
    });
  });

  it('revokes the family for previous-token replay outside the concurrency window', async () => {
    const previousToken = createRefreshToken(sessionId);
    mockedSession.findOne.mockReturnValue(
      queryResult(
        sessionDocument({
          refreshTokenHash: hashRefreshToken(createRefreshToken(sessionId)),
          previousRefreshTokenHash: hashRefreshToken(previousToken),
          rotatedAt: new Date(now.getTime() - 6000),
        }),
      ),
    );

    await expect(
      rotateSession(previousToken, tenantId, now),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_REUSED',
    });
    expect(mockedSession.updateOne).toHaveBeenCalledWith(
      { _id: sessionId, tenantId },
      { $set: { revokedAt: now, revokeReason: 'refresh_reuse' } },
    );
  });

  it('rejects an unknown refresh secret without revoking the selected family', async () => {
    mockedSession.findOne.mockReturnValue(
      queryResult(
        sessionDocument({
          refreshTokenHash: hashRefreshToken(createRefreshToken(sessionId)),
        }),
      ),
    );

    await expect(
      rotateSession(createRefreshToken(sessionId), tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(mockedSession.updateOne).not.toHaveBeenCalled();
  });

  it('handles a compare-and-swap loser as a concurrent previous-token retry', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const currentHash = hashRefreshToken(refreshToken);
    const initial = sessionDocument({ refreshTokenHash: currentHash });
    const latest = sessionDocument({
      refreshTokenHash: hashRefreshToken(createRefreshToken(sessionId)),
      previousRefreshTokenHash: currentHash,
      rotatedAt: now,
    });
    mockedSession.findOne
      .mockReturnValueOnce(queryResult(initial))
      .mockReturnValueOnce(queryResult(latest));
    mockedSession.updateOne.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0,
    });

    await expect(
      rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'REFRESH_ALREADY_ROTATED' });
  });

  it('rejects a compare-and-swap loser when its session disappeared', async () => {
    const refreshToken = createRefreshToken(sessionId);
    const initial = sessionDocument({
      refreshTokenHash: hashRefreshToken(refreshToken),
    });
    mockedSession.findOne
      .mockReturnValueOnce(queryResult(initial))
      .mockReturnValueOnce(queryResult(null));
    mockedSession.updateOne.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0,
    });

    await expect(
      rotateSession(refreshToken, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('lists, loads, and revokes only tenant/user-owned active sessions', async () => {
    const session = sessionDocument({ userAgentLabel: 'Browser' });
    mockedSession.findOne.mockReturnValue(queryResult(session));
    mockedSession.find.mockReturnValue({
      sort: vi.fn().mockResolvedValue([session]),
    });

    await expect(
      getSession(sessionId, userId, tenantId, now),
    ).resolves.toMatchObject({ id: sessionId, userAgentLabel: 'Browser' });
    await expect(listSessions(userId, tenantId, now)).resolves.toEqual([
      expect.objectContaining({ id: sessionId }),
    ]);
    await revokeSession(sessionId, userId, tenantId, 'current_logout', now);
    await revokeAllSessions(userId, tenantId, now);

    expect(mockedSession.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId, tenantId }),
    );
    expect(mockedSession.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: sessionId, userId, tenantId }),
      { $set: { revokedAt: now, revokeReason: 'current_logout' } },
    );
    expect(mockedSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ userId, tenantId }),
      { $set: { revokedAt: now, revokeReason: 'all_sessions_logout' } },
    );
  });

  it('rejects missing/inactive session reads and unknown revocation targets', async () => {
    mockedSession.findOne.mockReturnValueOnce(queryResult(null));
    await expect(
      getSession(sessionId, userId, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_AUTH_TOKEN' });

    mockedSession.findOne.mockReturnValueOnce(
      queryResult(sessionDocument({ revokedAt: now })),
    );
    await expect(
      getSession(sessionId, userId, tenantId, now),
    ).rejects.toMatchObject({ code: 'INVALID_AUTH_TOKEN' });

    mockedSession.updateOne.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0,
    });
    await expect(
      revokeSession(sessionId, userId, tenantId, 'user_revoked', now),
    ).rejects.toMatchObject({ statusCode: 404, code: 'SESSION_NOT_FOUND' });
  });

  it('does not persist empty display metadata', async () => {
    mockedSession.create.mockImplementation(
      async (input: Record<string, unknown>) => sessionDocument(input),
    );
    await createSession(userId, tenantId, 2, '   ', now);
    expect(
      mockedSession.create.mock.calls[0][0].userAgentLabel,
    ).toBeUndefined();

    const futureSession = sessionDocument({
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      absoluteExpiresAt: new Date('2099-02-01T00:00:00.000Z'),
    });
    mockedSession.findOne.mockReturnValue(queryResult(futureSession));
    mockedSession.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });

    await getSession(sessionId, userId, tenantId, now);
    await listSessions(userId, tenantId, now);
    await revokeSession(sessionId, userId, tenantId, 'user_revoked', now);
    await revokeAllSessions(userId, tenantId, now);

    expect(mockedSession.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({ revokeReason: 'user_revoked' }),
      }),
    );
  });
});
