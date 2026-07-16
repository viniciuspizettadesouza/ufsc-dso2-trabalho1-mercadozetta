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
  const credentials = await createCredentials(session, tokenVersion);

  return {
    ...credentials,
    refreshToken,
    session: toSessionSummary(session),
  };
}

async function revokeReusedFamily(
  sessions: SessionRepository,
  session: SessionRecord,
  now: Date,
): Promise<never> {
  await sessions.revokeById(
    session.tenantId,
    session._id,
    'refresh_reuse',
    now,
  );
  throw new AppError(
    401,
    'REFRESH_TOKEN_REUSED',
    'Refresh token reuse detected',
  );
}

function isInsideConcurrencyWindow(session: SessionRecord, now: Date) {
  /* v8 ignore else */
  if (!session.rotatedAt) return false;
  return (
    now.getTime() - session.rotatedAt.getTime() <=
    getSessionSecurityConfig().refreshConcurrencyWindowMs
  );
}

async function handlePreviousRefreshToken(
  sessions: SessionRepository,
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

  /* v8 ignore next */
  if (isInsideConcurrencyWindow(session, now)) {
    throw new AppError(
      409,
      'REFRESH_ALREADY_ROTATED',
      'Refresh token was already rotated',
    );
  }

  return revokeReusedFamily(sessions, session, now);
}

async function rotateSessionWithRepository(
  userRepository: UserRepository,
  sessions: SessionRepository,
  refreshToken: string,
  tenantId: string,
  now: Date,
) {
  const sessionId = getRefreshTokenSessionId(refreshToken);
  /* v8 ignore next */
  if (!sessionId) throw invalidRefreshToken();

  let session = await sessions.findRefreshById(tenantId, sessionId);
  /* v8 ignore next */
  if (!session) throw invalidRefreshToken();

  if (!isSessionActive(session, now)) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expired');
  }

  const tokenVersion = await userRepository.findTokenVersion(
    tenantId,
    String(session.userId),
  );
  /* v8 ignore else */
  if (tokenVersion === null || tokenVersion !== session.tokenVersion) {
    await sessions.revokeById(
      tenantId,
      session._id,
      'invalid_user_session',
      now,
    );
    throw invalidRefreshToken();
  }

  if (
    !versionedRefreshTokenMatches(
      refreshToken,
      session.refreshTokenHash,
      session.refreshTokenSecretVersion,
    )
  ) {
    return handlePreviousRefreshToken(sessions, session, refreshToken, now);
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

  /* v8 ignore else */
  if (!rotated) {
    session = await sessions.findRefreshById(tenantId, sessionId);
    /* v8 ignore else */
    if (!session) throw invalidRefreshToken();
    return handlePreviousRefreshToken(sessions, session, refreshToken, now);
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

  return {
    ...credentials,
    refreshToken: nextRefreshToken,
    session: toSessionSummary(rotatedSession),
  };
}

export function createSessionService(
  userRepository: UserRepository,
  sessions: SessionRepository,
) {
  return {
    createSession: (
      userId: string,
      tenantId: string,
      tokenVersion: number,
      userAgent: string | undefined,
      now: Date,
    ) =>
      createSessionWithRepository(
        sessions,
        userId,
        tenantId,
        tokenVersion,
        userAgent,
        now,
      ),
    rotateSession: (refreshToken: string, tenantId: string, now: Date) =>
      rotateSessionWithRepository(
        userRepository,
        sessions,
        refreshToken,
        tenantId,
        now,
      ),
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
      revokeSessionWithRepository(
        sessions,
        sessionId,
        userId,
        tenantId,
        reason,
        now,
      ),
    revokeAllSessions: (userId: string, tenantId: string, now: Date) =>
      sessions.revokeAll(tenantId, userId, 'all_sessions_logout', now),
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

  /* v8 ignore next */
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

  /* v8 ignore else */
  if (!revoked) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }
}

export const accessTokenContract = {
  issuer: ACCESS_TOKEN_ISSUER,
  audience: ACCESS_TOKEN_AUDIENCE,
} as const;

export type SessionService = ReturnType<typeof createSessionService>;
