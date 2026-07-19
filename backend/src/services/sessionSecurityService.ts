import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  type BinaryLike,
} from 'crypto';
import {
  getCsrfSecretKeyRing,
  getRefreshTokenHashKeyRing,
  getSessionSecurityConfig,
  type SessionSecurityConfig,
} from '@/config/security';
import { isUuid } from '@/ids';

const TOKEN_VALUE_PATTERN = /^[A-Za-z\d_-]{43}$/;
const SECRET_VERSION_PATTERN = /^[A-Za-z\d_-]{1,32}$/;

type SessionState = {
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt?: Date | null;
};

function hmac(value: BinaryLike, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createRefreshToken(sessionId: string) {
  if (!isUuid(sessionId)) throw new Error('Invalid session id');
  return `${sessionId}.${randomBytes(32).toString('base64url')}`;
}

export function getRefreshTokenSessionId(refreshToken: string) {
  const [sessionId, secret, extra] = refreshToken.split('.');

  if (
    extra !== undefined ||
    !sessionId ||
    !isUuid(sessionId) ||
    !secret ||
    !TOKEN_VALUE_PATTERN.test(secret)
  ) {
    return null;
  }

  return sessionId;
}

export function hashRefreshToken(refreshToken: string, secret?: string) {
  const ring = getRefreshTokenHashKeyRing();
  return hmac(refreshToken, secret || ring.keys[ring.activeVersion]);
}

export function refreshTokenMatches(
  refreshToken: string,
  expectedHash: string,
  secret?: string,
) {
  return safeEqual(hashRefreshToken(refreshToken, secret), expectedHash);
}

export function hashRefreshTokenWithActiveKey(refreshToken: string) {
  const ring = getRefreshTokenHashKeyRing();
  return {
    hash: hashRefreshToken(refreshToken, ring.keys[ring.activeVersion]),
    version: ring.activeVersion,
  };
}

export function versionedRefreshTokenMatches(
  refreshToken: string,
  expectedHash: string,
  version?: string,
) {
  if (!version) {
    const legacySecret = getRefreshTokenHashKeyRing().keys.legacy;
    return Boolean(
      legacySecret &&
      refreshTokenMatches(refreshToken, expectedHash, legacySecret),
    );
  }

  const secret = getRefreshTokenHashKeyRing().keys[version];
  return Boolean(
    secret && refreshTokenMatches(refreshToken, expectedHash, secret),
  );
}

export function createCsrfToken(sessionId: string, secret?: string) {
  if (!isUuid(sessionId)) throw new Error('Invalid session id');
  const nonce = randomBytes(32).toString('base64url');
  if (secret) return `${nonce}.${hmac(`${sessionId}.${nonce}`, secret)}`;

  const ring = getCsrfSecretKeyRing();
  return `${ring.activeVersion}.${nonce}.${hmac(
    `${sessionId}.${nonce}`,
    ring.keys[ring.activeVersion],
  )}`;
}

export function verifyCsrfToken(
  csrfToken: string,
  sessionId: string,
  secret?: string,
) {
  if (!isUuid(sessionId)) return false;

  const parts = csrfToken.split('.');
  const versioned = parts.length === 3;
  const [version, nonce, signature] = versioned
    ? parts
    : [undefined, parts[0], parts[1]];
  const signingSecret = secret
    ? secret
    : version
      ? getCsrfSecretKeyRing().keys[version]
      : getCsrfSecretKeyRing().keys.legacy;
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    (versioned && (!version || !SECRET_VERSION_PATTERN.test(version))) ||
    !nonce ||
    !TOKEN_VALUE_PATTERN.test(nonce) ||
    !signature ||
    !TOKEN_VALUE_PATTERN.test(signature) ||
    !signingSecret
  ) {
    return false;
  }

  return safeEqual(signature, hmac(`${sessionId}.${nonce}`, signingSecret));
}

export function getInitialSessionExpiry(
  now = new Date(),
  config: SessionSecurityConfig = getSessionSecurityConfig(),
) {
  const absoluteExpiresAt = new Date(now.getTime() + config.absoluteTtlMs);
  const expiresAt = new Date(
    Math.min(
      now.getTime() + config.refreshIdleTtlMs,
      absoluteExpiresAt.getTime(),
    ),
  );

  return { expiresAt, absoluteExpiresAt };
}

export function getRotatedSessionExpiry(
  absoluteExpiresAt: Date,
  now = new Date(),
  config: SessionSecurityConfig = getSessionSecurityConfig(),
) {
  return new Date(
    Math.min(
      now.getTime() + config.refreshIdleTtlMs,
      absoluteExpiresAt.getTime(),
    ),
  );
}

export function isSessionActive(session: SessionState, now = new Date()) {
  return (
    !session.revokedAt &&
    session.expiresAt.getTime() > now.getTime() &&
    session.absoluteExpiresAt.getTime() > now.getTime()
  );
}
