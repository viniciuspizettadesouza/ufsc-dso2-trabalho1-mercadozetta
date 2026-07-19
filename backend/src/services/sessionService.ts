import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  getJwtSigningKeyRing,
  getSessionSecurityConfig,
} from '@/config/security';
import AppError from '@/errors/AppError';
import type {
  SessionRecord,
  SessionRepository,
} from '@/repositories/sessionRepository';
import type { UserRepository } from '@/repositories/userRepository';
import type { AuditEventRepository } from '@/repositories/auditEventRepository';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import {
  createCsrfToken,
  createRefreshToken,
  getInitialSessionExpiry,
  getRefreshTokenSessionId,
  getRotatedSessionExpiry,
  hashRefreshTokenWithActiveKey,
  isSessionActive,
  versionedRefreshTokenMatches,
} from '@/services/sessionSecurityService';

const ACCESS_TOKEN_ISSUER = 'mercadozetta';
const ACCESS_TOKEN_AUDIENCE = 'mercadozetta-api';

type SessionSummarySource = Pick<
  SessionRecord,
  | '_id'
  | 'createdAt'
  | 'lastUsedAt'
  | 'expiresAt'
  | 'absoluteExpiresAt'
  | 'userAgentLabel'
>;

function invalidRefreshToken() {
  return new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
}

function toSessionSummary(session: SessionSummarySource) {
  return {
    id: String(session._id),
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    userAgentLabel: session.userAgentLabel,
  };
}

function createAccessToken(
  userId: string,
  tenantId: string,
  sessionId: string,
  tokenVersion: number,
) {
  const { accessTokenTtlMs } = getSessionSecurityConfig();
  const signingKeys = getJwtSigningKeyRing();

  return jwt.sign(
    {
      tenantId,
      sid: sessionId,
      tokenVersion,
      typ: 'access',
    },
    signingKeys.keys[signingKeys.activeKid],
    {
      algorithm: 'HS256',
      keyid: signingKeys.activeKid,
      subject: userId,
      expiresIn: Math.floor(accessTokenTtlMs / 1000),
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    },
  );
}

function getSafeUserAgentLabel(userAgent?: string) {
  const label = userAgent?.replace(/[\r\n]/g, ' ').trim();
  return label ? label.slice(0, 120) : undefined;
}

async function createCredentials(session: SessionRecord, tokenVersion: number) {
  const sessionId = String(session._id);
  return {
    accessToken: createAccessToken(
      String(session.userId),
      session.tenantId,
      sessionId,
      tokenVersion,
    ),
    csrfToken: createCsrfToken(sessionId),
  };
}

async function createSessionWithRepository(
  sessions: SessionRepository,
  audits: AuditEventRepository,
  userId: string,
  tenantId: string,
  tokenVersion: number,
  userAgent: string | undefined,
  now: Date,
) {
  const sessionId = randomUUID();
  const refreshToken = createRefreshToken(sessionId);
  const refreshHash = hashRefreshTokenWithActiveKey(refreshToken);
  const expiry = getInitialSessionExpiry(now);
  const session = await sessions.create({
    _id: sessionId,
    tenantId,
    userId,
    familyId: randomUUID(),
    tokenVersion,
    refreshTokenHash: refreshHash.hash,
    refreshTokenSecretVersion: refreshHash.version,
    rotationCounter: 0,
    lastUsedAt: now,
    ...expiry,
    userAgentLabel: getSafeUserAgentLabel(userAgent),
    createdAt: now,
    updatedAt: now,
  });
  await audits.append({
    tenantId,
    eventType: 'session.created',
    actorId: userId,
    resourceType: 'session',
    resourceId: sessionId,
    occurredAt: now,
  });
  const credentials = await createCredentials(session, tokenVersion);

  return {
    ...credentials,
    refreshToken,
    session: toSessionSummary(session),
  };
}

async function revokeReusedFamily(
  sessions: SessionRepository,
  audits: AuditEventRepository,
  session: SessionRecord,
  now: Date,
) {
  await sessions.revokeById(
    session.tenantId,
    session._id,
    'refresh_reuse',
    now,
  );
  await audits.append({
    tenantId: session.tenantId,
    eventType: 'session.reuse_detected',
    actorId: session.userId,
    resourceType: 'session',
    resourceId: session._id,
    metadata: { reason: 'refresh_reuse' },
    occurredAt: now,
  });
  return {
    committedError: new AppError(
      401,
      'REFRESH_TOKEN_REUSED',
      'Refresh token reuse detected',
    ),
  };
}

function isInsideConcurrencyWindow(session: SessionRecord, now: Date) {
  if (!session.rotatedAt) return false;
  return (
    now.getTime() - session.rotatedAt.getTime() <=
    getSessionSecurityConfig().refreshConcurrencyWindowMs
  );
}

async function handlePreviousRefreshToken(
  sessions: SessionRepository,
  audits: AuditEventRepository,
  session: SessionRecord,
  refreshToken: string,
  now: Date,
) {
  if (
    !session.previousRefreshTokenHash ||
    !versionedRefreshTokenMatches(
      refreshToken,
      session.previousRefreshTokenHash,
      session.previousRefreshTokenSecretVersion,
    )
  ) {
    throw invalidRefreshToken();
  }

  if (isInsideConcurrencyWindow(session, now)) {
    throw new AppError(
      409,
      'REFRESH_ALREADY_ROTATED',
      'Refresh token was already rotated',
    );
  }

  return revokeReusedFamily(sessions, audits, session, now);
}

async function rotateSessionWithRepository(
  userRepository: UserRepository,
  sessions: SessionRepository,
  audits: AuditEventRepository,
  refreshToken: string,
  tenantId: string,
  now: Date,
) {
  const sessionId = getRefreshTokenSessionId(refreshToken);
  if (!sessionId) throw invalidRefreshToken();

  let session = await sessions.findRefreshById(tenantId, sessionId);
  if (!session) throw invalidRefreshToken();

  if (!isSessionActive(session, now)) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expired');
  }

  const tokenVersion = await userRepository.findTokenVersion(
    tenantId,
    String(session.userId),
  );
  if (tokenVersion === null || tokenVersion !== session.tokenVersion) {
    await sessions.revokeById(
      tenantId,
      session._id,
      'invalid_user_session',
      now,
    );
    await audits.append({
      tenantId,
      eventType: 'session.revoked',
      actorId: session.userId,
      resourceType: 'session',
      resourceId: session._id,
      metadata: { reason: 'invalid_user_session' },
      occurredAt: now,
    });
    return { committedError: invalidRefreshToken() };
  }

  if (
    !versionedRefreshTokenMatches(
      refreshToken,
      session.refreshTokenHash,
      session.refreshTokenSecretVersion,
    )
  ) {
    return handlePreviousRefreshToken(
      sessions,
      audits,
      session,
      refreshToken,
      now,
    );
  }

  const nextRefreshToken = createRefreshToken(sessionId);
  const nextRefreshHash = hashRefreshTokenWithActiveKey(nextRefreshToken);
  const nextRefreshTokenHash = nextRefreshHash.hash;
  const expiresAt = getRotatedSessionExpiry(session.absoluteExpiresAt, now);
  const rotated = await sessions.rotateCurrent({
    sessionId: session._id,
    tenantId,
    expectedRefreshTokenHash: session.refreshTokenHash,
    previousRefreshTokenSecretVersion:
      session.refreshTokenSecretVersion || 'legacy',
    nextRefreshTokenHash,
    nextRefreshTokenSecretVersion: nextRefreshHash.version,
    now,
    expiresAt,
  });

  if (!rotated) {
    session = await sessions.findRefreshById(tenantId, sessionId);
    if (!session) throw invalidRefreshToken();
    return handlePreviousRefreshToken(
      sessions,
      audits,
      session,
      refreshToken,
      now,
    );
  }

  const rotatedSession = {
    ...session,
    refreshTokenHash: nextRefreshTokenHash,
    previousRefreshTokenHash: session.refreshTokenHash,
    previousRefreshTokenSecretVersion:
      session.refreshTokenSecretVersion || 'legacy',
    refreshTokenSecretVersion: nextRefreshHash.version,
    rotationCounter: session.rotationCounter + 1,
    rotatedAt: now,
    lastUsedAt: now,
    expiresAt,
  } as SessionRecord;
  const credentials = await createCredentials(
    rotatedSession,
    session.tokenVersion,
  );
  await audits.append({
    tenantId,
    eventType: 'session.rotated',
    actorId: session.userId,
    resourceType: 'session',
    resourceId: session._id,
    metadata: { rotationCounter: rotatedSession.rotationCounter },
    occurredAt: now,
  });

  return {
    ...credentials,
    refreshToken: nextRefreshToken,
    session: toSessionSummary(rotatedSession),
  };
}

export function createSessionService(
  sessions: SessionRepository,
  transactions: CheckoutTransactionCoordinator,
) {
  return {
    createSession: (
      userId: string,
      tenantId: string,
      tokenVersion: number,
      userAgent: string | undefined,
      now: Date,
    ) =>
      transactions.run(({ sessions: transactionSessions, audits }) =>
        createSessionWithRepository(
          transactionSessions,
          audits,
          userId,
          tenantId,
          tokenVersion,
          userAgent,
          now,
        ),
      ),
    rotateSession: async (
      refreshToken: string,
      tenantId: string,
      now: Date,
    ) => {
      const result = await transactions.run(
        ({ users: transactionUsers, sessions: transactionSessions, audits }) =>
          rotateSessionWithRepository(
            transactionUsers,
            transactionSessions,
            audits,
            refreshToken,
            tenantId,
            now,
          ),
      );
      if ('committedError' in result) throw result.committedError;
      return result;
    },
    getSession: (
      sessionId: string,
      userId: string,
      tenantId: string,
      now: Date,
    ) => getSessionWithRepository(sessions, sessionId, userId, tenantId, now),
    listSessions: (userId: string, tenantId: string, now: Date) =>
      listSessionsWithRepository(sessions, userId, tenantId, now),
    revokeSession: (
      sessionId: string,
      userId: string,
      tenantId: string,
      reason: string,
      now: Date,
    ) =>
      transactions.run(({ sessions: transactionSessions, audits }) =>
        revokeSessionWithRepository(
          transactionSessions,
          audits,
          sessionId,
          userId,
          tenantId,
          reason,
          now,
        ),
      ),
    revokeAllSessions: (userId: string, tenantId: string, now: Date) =>
      transactions.run(async ({ sessions: transactionSessions, audits }) => {
        await transactionSessions.revokeAll(
          tenantId,
          userId,
          'all_sessions_logout',
          now,
        );
        await audits.append({
          tenantId,
          eventType: 'session.revoked',
          actorId: userId,
          resourceType: 'user',
          resourceId: userId,
          metadata: { reason: 'all_sessions_logout' },
          occurredAt: now,
        });
      }),
    deleteExpiredSessions: (now: Date) => sessions.deleteExpired(now),
  };
}

async function getSessionWithRepository(
  sessions: SessionRepository,
  sessionId: string,
  userId: string,
  tenantId: string,
  now: Date,
) {
  const session = await sessions.findOwned(tenantId, userId, sessionId);

  if (!session || !isSessionActive(session, now)) {
    throw new AppError(
      401,
      'INVALID_AUTH_TOKEN',
      'Invalid authorization token',
    );
  }

  return toSessionSummary(session);
}

async function listSessionsWithRepository(
  sessions: SessionRepository,
  userId: string,
  tenantId: string,
  now: Date,
) {
  return (await sessions.listActive(tenantId, userId, now)).map(
    toSessionSummary,
  );
}

async function revokeSessionWithRepository(
  sessions: SessionRepository,
  audits: AuditEventRepository,
  sessionId: string,
  userId: string,
  tenantId: string,
  reason: string,
  now: Date,
) {
  const revoked = await sessions.revokeOwned(
    tenantId,
    userId,
    sessionId,
    reason,
    now,
  );

  if (!revoked) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }
  await audits.append({
    tenantId,
    eventType: 'session.revoked',
    actorId: userId,
    resourceType: 'session',
    resourceId: sessionId,
    metadata: { reason },
    occurredAt: now,
  });
}

export const accessTokenContract = {
  issuer: ACCESS_TOKEN_ISSUER,
  audience: ACCESS_TOKEN_AUDIENCE,
} as const;

export type SessionService = ReturnType<typeof createSessionService>;
