import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCsrfToken,
  createRefreshToken,
  getInitialSessionExpiry,
  getRefreshTokenSessionId,
  getRotatedSessionExpiry,
  hashRefreshToken,
  hashRefreshTokenWithActiveKey,
  isSessionActive,
  refreshTokenMatches,
  versionedRefreshTokenMatches,
  verifyCsrfToken,
} from '@/services/sessionSecurityService';

const sessionId = '507f1f77bcf86cd799439011';
const anotherSessionId = '507f1f77bcf86cd799439012';
const refreshHashSecret = 'test-refresh-hash-secret';
const csrfSecret = 'test-csrf-secret';
const config = {
  accessTokenTtlMs: 5 * 60 * 1000,
  refreshIdleTtlMs: 7 * 24 * 60 * 60 * 1000,
  absoluteTtlMs: 30 * 24 * 60 * 60 * 1000,
  refreshConcurrencyWindowMs: 5000,
};

describe('session security service', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('creates opaque refresh tokens with a validated session selector', () => {
    const first = createRefreshToken(sessionId);
    const second = createRefreshToken(sessionId);

    expect(first).not.toBe(second);
    expect(getRefreshTokenSessionId(first)).toBe(sessionId);
    expect(first).toMatch(new RegExp(`^${sessionId}\\.[A-Za-z0-9_-]{43}$`));
    expect(() => createRefreshToken('not-an-object-id')).toThrow(
      'Invalid session id',
    );
  });

  it('rejects malformed refresh tokens without exposing a selector', () => {
    expect(getRefreshTokenSessionId('')).toBeNull();
    expect(getRefreshTokenSessionId(`${sessionId}.short`)).toBeNull();
    expect(
      getRefreshTokenSessionId(`${sessionId}.${'a'.repeat(43)}.extra`),
    ).toBeNull();
  });

  it('hashes refresh tokens with a dedicated secret and compares them safely', () => {
    const refreshToken = createRefreshToken(sessionId);
    const hash = hashRefreshToken(refreshToken, refreshHashSecret);

    expect(hash).toHaveLength(43);
    expect(hash).not.toContain(refreshToken);
    expect(refreshTokenMatches(refreshToken, hash, refreshHashSecret)).toBe(
      true,
    );
    expect(
      refreshTokenMatches(
        createRefreshToken(sessionId),
        hash,
        refreshHashSecret,
      ),
    ).toBe(false);
    expect(refreshTokenMatches(refreshToken, 'short', refreshHashSecret)).toBe(
      false,
    );
  });

  it('creates CSRF proofs bound to one session and secret', () => {
    const csrfToken = createCsrfToken(sessionId, csrfSecret);

    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/);
    expect(verifyCsrfToken(csrfToken, sessionId, csrfSecret)).toBe(true);
    expect(verifyCsrfToken(csrfToken, anotherSessionId, csrfSecret)).toBe(
      false,
    );
    expect(verifyCsrfToken(csrfToken, sessionId, 'another-secret')).toBe(false);
    expect(verifyCsrfToken(`${csrfToken}x`, sessionId, csrfSecret)).toBe(false);
    expect(verifyCsrfToken('malformed', sessionId, csrfSecret)).toBe(false);
    expect(verifyCsrfToken(csrfToken, 'invalid-session', csrfSecret)).toBe(
      false,
    );
  });

  it('keeps refresh and CSRF verification keys valid across active-secret rotation', () => {
    const refreshToken = createRefreshToken(sessionId);
    vi.stubEnv(
      'REFRESH_TOKEN_HASH_SECRETS',
      JSON.stringify({
        current: 'refresh-current',
        previous: 'refresh-previous',
      }),
    );
    vi.stubEnv('REFRESH_TOKEN_HASH_ACTIVE_VERSION', 'current');
    const currentHash = hashRefreshTokenWithActiveKey(refreshToken);
    const previousHash = hashRefreshToken(refreshToken, 'refresh-previous');

    expect(currentHash.version).toBe('current');
    expect(
      versionedRefreshTokenMatches(refreshToken, currentHash.hash, 'current'),
    ).toBe(true);
    expect(
      versionedRefreshTokenMatches(refreshToken, previousHash, 'previous'),
    ).toBe(true);
    expect(
      versionedRefreshTokenMatches(refreshToken, previousHash, 'removed'),
    ).toBe(false);

    vi.stubEnv(
      'CSRF_SECRETS',
      JSON.stringify({ previous: 'csrf-previous', current: 'csrf-current' }),
    );
    vi.stubEnv('CSRF_ACTIVE_VERSION', 'previous');
    const previousProof = createCsrfToken(sessionId);
    expect(previousProof.startsWith('previous.')).toBe(true);

    vi.stubEnv('CSRF_ACTIVE_VERSION', 'current');
    const currentProof = createCsrfToken(sessionId);
    expect(currentProof.startsWith('current.')).toBe(true);
    expect(verifyCsrfToken(previousProof, sessionId)).toBe(true);
    expect(verifyCsrfToken(currentProof, sessionId)).toBe(true);
  });

  it('verifies versionless rollout artifacts only through an explicitly retained legacy key', () => {
    const refreshToken = createRefreshToken(sessionId);
    vi.stubEnv(
      'REFRESH_TOKEN_HASH_SECRETS',
      JSON.stringify({ current: 'refresh-current', legacy: 'refresh-legacy' }),
    );
    vi.stubEnv('REFRESH_TOKEN_HASH_ACTIVE_VERSION', 'current');
    const legacyHash = hashRefreshToken(refreshToken, 'refresh-legacy');

    expect(versionedRefreshTokenMatches(refreshToken, legacyHash)).toBe(true);

    vi.stubEnv(
      'CSRF_SECRETS',
      JSON.stringify({ current: 'csrf-current', legacy: 'csrf-legacy' }),
    );
    vi.stubEnv('CSRF_ACTIVE_VERSION', 'current');
    const legacyProof = createCsrfToken(sessionId, 'csrf-legacy');
    expect(verifyCsrfToken(legacyProof, sessionId)).toBe(true);
  });

  it('calculates idle and absolute expiry without extending the absolute limit', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const initial = getInitialSessionExpiry(now, config);

    expect(initial.expiresAt).toEqual(new Date('2026-07-22T12:00:00.000Z'));
    expect(initial.absoluteExpiresAt).toEqual(
      new Date('2026-08-14T12:00:00.000Z'),
    );

    expect(
      getRotatedSessionExpiry(
        initial.absoluteExpiresAt,
        new Date('2026-08-12T12:00:00.000Z'),
        config,
      ),
    ).toEqual(initial.absoluteExpiresAt);
  });

  it('treats revoked, idle-expired, and absolute-expired sessions as inactive', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const activeState = {
      expiresAt: new Date('2026-07-16T12:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-08-01T12:00:00.000Z'),
    };

    expect(isSessionActive(activeState, now)).toBe(true);
    expect(isSessionActive({ ...activeState, revokedAt: now }, now)).toBe(
      false,
    );
    expect(isSessionActive({ ...activeState, expiresAt: now }, now)).toBe(
      false,
    );
    expect(
      isSessionActive({ ...activeState, absoluteExpiresAt: now }, now),
    ).toBe(false);
  });
});
