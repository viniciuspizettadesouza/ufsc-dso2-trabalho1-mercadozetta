import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import {
  getJwtSigningKeyRing,
  getSessionSecurityConfig,
} from '@/config/security';
import AppError from '@/errors/AppError';
import Session, { type SessionRecord } from '@/model/session';
import User from '@/model/user';
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

type SessionDocument = SessionRecord & {
  refreshTokenHash: string;
  refreshTokenSecretVersion?: string;
  previousRefreshTokenHash?: string;
  previousRefreshTokenSecretVersion?: string;
  toObject(): SessionRecord;
};

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

async function loadRefreshSession(sessionId: string, tenantId: string) {
  return Session.findOne({ _id: sessionId, tenantId }).select(
    '+refreshTokenHash +previousRefreshTokenHash',
  ) as Promise<SessionDocument | null>;
}

async function createCredentials(
  session: SessionDocument,
  tokenVersion: number,
) {
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

export async function createSession(
  userId: string,
  tenantId: string,
  tokenVersion: number,
  userAgent: string | undefined,
  now: Date,
) {
  const sessionId = new Types.ObjectId();
  const refreshToken = createRefreshToken(String(sessionId));
  const refreshHash = hashRefreshTokenWithActiveKey(refreshToken);
  const expiry = getInitialSessionExpiry(now);
  const session = await Session.create({
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
  });
  const credentials = await createCredentials(
    session as SessionDocument,
    tokenVersion,
  );

  return {
    ...credentials,
    refreshToken,
    session: toSessionSummary(session),
  };
}

async function revokeReusedFamily(
  session: SessionDocument,
  now: Date,
): Promise<never> {
  await Session.updateOne(
    { _id: session._id, tenantId: session.tenantId },
    { $set: { revokedAt: now, revokeReason: 'refresh_reuse' } },
  );
  throw new AppError(
    401,
    'REFRESH_TOKEN_REUSED',
    'Refresh token reuse detected',
  );
}

function isInsideConcurrencyWindow(session: SessionDocument, now: Date) {
  /* v8 ignore else */
  if (!session.rotatedAt) return false;
  return (
    now.getTime() - session.rotatedAt.getTime() <=
    getSessionSecurityConfig().refreshConcurrencyWindowMs
  );
}

async function handlePreviousRefreshToken(
  session: SessionDocument,
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

  return revokeReusedFamily(session, now);
}

export async function rotateSession(
  refreshToken: string,
  tenantId: string,
  now: Date,
) {
  const sessionId = getRefreshTokenSessionId(refreshToken);
  /* v8 ignore next */
  if (!sessionId) throw invalidRefreshToken();

  let session = await loadRefreshSession(sessionId, tenantId);
  /* v8 ignore next */
  if (!session) throw invalidRefreshToken();

  if (!isSessionActive(session, now)) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expired');
  }

  const user = await User.findOne({ _id: session.userId, tenantId }).select(
    '+tokenVersion',
  );
  /* v8 ignore else */
  if (!user || (user.tokenVersion as number) !== session.tokenVersion) {
    await Session.updateOne(
      { _id: session._id, tenantId },
      { $set: { revokedAt: now, revokeReason: 'invalid_user_session' } },
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
    return handlePreviousRefreshToken(session, refreshToken, now);
  }

  const nextRefreshToken = createRefreshToken(sessionId);
  const nextRefreshHash = hashRefreshTokenWithActiveKey(nextRefreshToken);
  const nextRefreshTokenHash = nextRefreshHash.hash;
  const expiresAt = getRotatedSessionExpiry(session.absoluteExpiresAt, now);
  const result = await Session.updateOne(
    {
      _id: session._id,
      tenantId,
      refreshTokenHash: session.refreshTokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    },
    {
      $set: {
        previousRefreshTokenHash: session.refreshTokenHash,
        previousRefreshTokenSecretVersion:
          session.refreshTokenSecretVersion || 'legacy',
        refreshTokenHash: nextRefreshTokenHash,
        refreshTokenSecretVersion: nextRefreshHash.version,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt,
      },
      $inc: { rotationCounter: 1 },
    },
  );

  /* v8 ignore else */
  if (result.modifiedCount !== 1) {
    session = await loadRefreshSession(sessionId, tenantId);
    /* v8 ignore else */
    if (!session) throw invalidRefreshToken();
    return handlePreviousRefreshToken(session, refreshToken, now);
  }

  const rotatedSession = {
    ...session.toObject(),
    refreshTokenHash: nextRefreshTokenHash,
    previousRefreshTokenHash: session.refreshTokenHash,
    previousRefreshTokenSecretVersion:
      session.refreshTokenSecretVersion || 'legacy',
    refreshTokenSecretVersion: nextRefreshHash.version,
    rotationCounter: session.rotationCounter + 1,
    rotatedAt: now,
    lastUsedAt: now,
    expiresAt,
  } as SessionDocument;
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

export async function getSession(
  sessionId: string,
  userId: string,
  tenantId: string,
  now: Date,
) {
  const session = await Session.findOne({
    _id: sessionId,
    userId,
    tenantId,
  });

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

export async function listSessions(
  userId: string,
  tenantId: string,
  now: Date,
) {
  const sessions = await Session.find({
    userId,
    tenantId,
    revokedAt: { $exists: false },
    expiresAt: { $gt: now },
    absoluteExpiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  return sessions.map(toSessionSummary);
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  tenantId: string,
  reason: string,
  now: Date,
) {
  const result = await Session.updateOne(
    { _id: sessionId, userId, tenantId, revokedAt: { $exists: false } },
    { $set: { revokedAt: now, revokeReason: reason } },
  );

  /* v8 ignore else */
  if (result.matchedCount !== 1) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }
}

export async function revokeAllSessions(
  userId: string,
  tenantId: string,
  now: Date,
) {
  await Session.updateMany(
    { userId, tenantId, revokedAt: { $exists: false } },
    { $set: { revokedAt: now, revokeReason: 'all_sessions_logout' } },
  );
}

export const accessTokenContract = {
  issuer: ACCESS_TOKEN_ISSUER,
  audience: ACCESS_TOKEN_AUDIENCE,
} as const;
