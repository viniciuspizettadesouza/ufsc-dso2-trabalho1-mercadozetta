import { afterEach, describe, expect, it, vi } from 'vitest';
import * as security from '@/config/security';

const securityPath = require.resolve('@/config/security');

function loadSecurityWithEnv(env = {}) {
  delete require.cache[securityPath];
  process.env = {
    ...env,
  };
  return require('@/config/security');
}

describe('security config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    delete require.cache[securityPath];
  });

  it('parses versioned signing and dedicated-secret key rings', () => {
    const configured = loadSecurityWithEnv({
      NODE_ENV: 'production',
      JWT_SIGNING_KEYS: JSON.stringify({ current: 'jwt-2', previous: 'jwt-1' }),
      JWT_ACTIVE_KID: 'current',
      REFRESH_TOKEN_HASH_SECRETS: JSON.stringify({
        v2: 'refresh-2',
        v1: 'refresh-1',
      }),
      REFRESH_TOKEN_HASH_ACTIVE_VERSION: 'v2',
      CSRF_SECRETS: JSON.stringify({ v2: 'csrf-2', v1: 'csrf-1' }),
      CSRF_ACTIVE_VERSION: 'v2',
      ACCOUNT_TOKEN_HASH_SECRETS: JSON.stringify({
        v2: 'account-token-2',
        v1: 'account-token-1',
      }),
      ACCOUNT_TOKEN_HASH_ACTIVE_VERSION: 'v2',
    });

    expect(configured.getJwtSigningKeyRing()).toEqual({
      activeKid: 'current',
      keys: { current: 'jwt-2', previous: 'jwt-1' },
    });
    expect(configured.getRefreshTokenHashKeyRing()).toEqual({
      activeVersion: 'v2',
      keys: { v2: 'refresh-2', v1: 'refresh-1' },
    });
    expect(configured.getCsrfSecretKeyRing()).toEqual({
      activeVersion: 'v2',
      keys: { v2: 'csrf-2', v1: 'csrf-1' },
    });
    expect(configured.getAccountTokenHashKeyRing()).toEqual({
      activeVersion: 'v2',
      keys: { v2: 'account-token-2', v1: 'account-token-1' },
    });
    expect(() => configured.validateSecurityConfig()).not.toThrow();
  });

  it('rejects malformed key rings and unknown active versions', () => {
    expect(() =>
      loadSecurityWithEnv({
        JWT_SIGNING_KEYS: 'not-json',
        JWT_ACTIVE_KID: 'current',
      }).getJwtSigningKeyRing(),
    ).toThrow('JWT_SIGNING_KEYS must be a JSON object');

    expect(() =>
      loadSecurityWithEnv({
        CSRF_SECRETS: JSON.stringify({ current: 'secret' }),
        CSRF_ACTIVE_VERSION: 'missing',
      }).getCsrfSecretKeyRing(),
    ).toThrow('CSRF_ACTIVE_VERSION must select a key');

    expect(() =>
      loadSecurityWithEnv({
        REFRESH_TOKEN_HASH_SECRETS: JSON.stringify({ 'bad.version': 'secret' }),
        REFRESH_TOKEN_HASH_ACTIVE_VERSION: 'bad.version',
      }).getRefreshTokenHashKeyRing(),
    ).toThrow('contains an invalid version or secret');

    expect(() =>
      loadSecurityWithEnv({
        ACCOUNT_TOKEN_HASH_SECRETS: JSON.stringify({ current: 'secret' }),
        ACCOUNT_TOKEN_HASH_ACTIVE_VERSION: 'missing',
      }).getAccountTokenHashKeyRing(),
    ).toThrow('ACCOUNT_TOKEN_HASH_ACTIVE_VERSION must select a key');
  });

  it('uses distinct local-only key-ring fallbacks', () => {
    const local = loadSecurityWithEnv({ NODE_ENV: 'test' });
    expect(local.getJwtSigningKeyRing()).toEqual({
      activeKid: 'local',
      keys: { local: 'mercadozetta-dev-secret' },
    });
    expect(local.getRefreshTokenHashKeyRing().activeVersion).toBe('local');
    expect(local.getCsrfSecretKeyRing().activeVersion).toBe('local');
    expect(local.getAccountTokenHashKeyRing().activeVersion).toBe('local');
  });

  it('requires every versioned key ring outside local environments', () => {
    const production = loadSecurityWithEnv({ NODE_ENV: 'production' });
    expect(() => production.getJwtSigningKeyRing()).toThrow(
      'JWT_SIGNING_KEYS is required',
    );
    expect(() => production.getRefreshTokenHashKeyRing()).toThrow(
      'REFRESH_TOKEN_HASH_SECRETS is required',
    );
    expect(() => production.getCsrfSecretKeyRing()).toThrow(
      'CSRF_SECRETS is required',
    );
    expect(() => production.getAccountTokenHashKeyRing()).toThrow(
      'ACCOUNT_TOKEN_HASH_SECRETS is required',
    );
  });

  it('provides bounded session lifetime defaults and accepts valid overrides', () => {
    expect(loadSecurityWithEnv({}).getSessionSecurityConfig()).toEqual({
      accessTokenTtlMs: 5 * 60 * 1000,
      refreshIdleTtlMs: 7 * 24 * 60 * 60 * 1000,
      absoluteTtlMs: 30 * 24 * 60 * 60 * 1000,
      refreshConcurrencyWindowMs: 5 * 1000,
    });

    expect(
      loadSecurityWithEnv({
        SESSION_ACCESS_TOKEN_TTL_MS: '60000',
        SESSION_REFRESH_IDLE_TTL_MS: '3600000',
        SESSION_ABSOLUTE_TTL_MS: '86400000',
        SESSION_REFRESH_CONCURRENCY_WINDOW_MS: '1000',
      }).getSessionSecurityConfig(),
    ).toEqual({
      accessTokenTtlMs: 60000,
      refreshIdleTtlMs: 3600000,
      absoluteTtlMs: 86400000,
      refreshConcurrencyWindowMs: 1000,
    });
  });

  it('provides bounded account-token lifetimes and hidden issuance limits', () => {
    expect(loadSecurityWithEnv({}).getAccountSecurityConfig()).toEqual({
      emailVerificationTokenTtlMs: 8 * 60 * 60 * 1000,
      emailChangeTokenTtlMs: 30 * 60 * 1000,
      passwordResetTokenTtlMs: 30 * 60 * 1000,
      requestResponseFloorMs: 500,
      issueCooldownMs: 60 * 1000,
      issueWindowMs: 60 * 60 * 1000,
      issueMax: 3,
    });
    expect(
      loadSecurityWithEnv({
        EMAIL_VERIFICATION_TOKEN_TTL_MS: '3600000',
        EMAIL_CHANGE_TOKEN_TTL_MS: '900000',
        PASSWORD_RESET_TOKEN_TTL_MS: '600000',
        ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS: '10000',
        ACCOUNT_TOKEN_ISSUE_WINDOW_MS: '60000',
        ACCOUNT_TOKEN_ISSUE_MAX: '2',
        ACCOUNT_REQUEST_RESPONSE_FLOOR_MS: '100',
      }).getAccountSecurityConfig(),
    ).toEqual({
      emailVerificationTokenTtlMs: 3600000,
      emailChangeTokenTtlMs: 900000,
      passwordResetTokenTtlMs: 600000,
      requestResponseFloorMs: 100,
      issueCooldownMs: 10000,
      issueWindowMs: 60000,
      issueMax: 2,
    });
  });

  it('rejects invalid account-token configuration', () => {
    expect(() =>
      loadSecurityWithEnv({
        EMAIL_VERIFICATION_TOKEN_TTL_MS: '1000',
      }).getAccountSecurityConfig(),
    ).toThrow('EMAIL_VERIFICATION_TOKEN_TTL_MS must be an integer');
    expect(() =>
      loadSecurityWithEnv({
        EMAIL_CHANGE_TOKEN_TTL_MS: '1000',
      }).getAccountSecurityConfig(),
    ).toThrow('EMAIL_CHANGE_TOKEN_TTL_MS must be an integer');
    expect(() =>
      loadSecurityWithEnv({
        ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS: '120000',
        ACCOUNT_TOKEN_ISSUE_WINDOW_MS: '60000',
      }).getAccountSecurityConfig(),
    ).toThrow(
      'ACCOUNT_TOKEN_ISSUE_WINDOW_MS must be greater than or equal to ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS',
    );
  });

  it('rejects invalid session lifetimes and an idle window beyond the absolute lifetime', () => {
    expect(() =>
      loadSecurityWithEnv({
        SESSION_ACCESS_TOKEN_TTL_MS: '59999',
      }).getSessionSecurityConfig(),
    ).toThrow('SESSION_ACCESS_TOKEN_TTL_MS must be an integer');

    expect(() =>
      loadSecurityWithEnv({
        SESSION_REFRESH_IDLE_TTL_MS: String(2 * 24 * 60 * 60 * 1000),
        SESSION_ABSOLUTE_TTL_MS: String(24 * 60 * 60 * 1000),
      }).getSessionSecurityConfig(),
    ).toThrow(
      'SESSION_ABSOLUTE_TTL_MS must be greater than or equal to SESSION_REFRESH_IDLE_TTL_MS',
    );
  });

  it('uses host-prefixed secure production cookies and scoped refresh transport', () => {
    const { getAuthCookieConfig } = loadSecurityWithEnv({
      NODE_ENV: 'production',
    });

    expect(getAuthCookieConfig()).toEqual({
      access: {
        name: '__Host-mz_at',
        options: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 5 * 60 * 1000,
        },
      },
      refresh: {
        name: '__Secure-mz_rt',
        options: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/auth',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      },
      csrf: {
        name: '__Host-mz_csrf',
        options: {
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      },
    });
  });

  it('uses non-prefixed, insecure cookies only in local environments', () => {
    const { getAuthCookieConfig } = loadSecurityWithEnv({
      NODE_ENV: 'development',
    });
    const cookies = getAuthCookieConfig();

    expect(cookies.access.name).toBe('mz_at');
    expect(cookies.refresh.name).toBe('mz_rt');
    expect(cookies.csrf.name).toBe('mz_csrf');
    expect(cookies.access.options.secure).toBe(false);
    expect(cookies.refresh.options.secure).toBe(false);
    expect(cookies.csrf.options.secure).toBe(false);
  });

  it('requires tenant headers outside local environments unless explicitly configured', () => {
    expect(
      loadSecurityWithEnv({ NODE_ENV: 'production' }).isTenantHeaderRequired(),
    ).toBe(true);
    expect(
      loadSecurityWithEnv({ NODE_ENV: 'development' }).isTenantHeaderRequired(),
    ).toBe(false);
    expect(
      loadSecurityWithEnv({
        NODE_ENV: 'production',
        TENANT_HEADER_REQUIRED: 'false',
      }).isTenantHeaderRequired(),
    ).toBe(false);
    expect(
      loadSecurityWithEnv({
        NODE_ENV: 'test',
        TENANT_HEADER_REQUIRED: 'true',
      }).isTenantHeaderRequired(),
    ).toBe(true);
  });

  it('parses configured CORS origins and accepts requests without an origin', () => {
    const { getAllowedCorsOrigins, getCorsOptions } = loadSecurityWithEnv({
      NODE_ENV: 'production',
      CORS_ORIGIN: ' https://app.example.com,https://admin.example.com ',
    });

    expect(getAllowedCorsOrigins()).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);

    const callback = vi.fn();
    getCorsOptions().origin(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('checks configured CORS origins', () => {
    const { getCorsOptions } = loadSecurityWithEnv({
      CORS_ORIGIN: 'https://app.example.com',
    });
    const callback = vi.fn();

    getCorsOptions().origin('https://other.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('returns rate-limit defaults and accepts positive integer overrides', () => {
    const { getRateLimitConfig } = loadSecurityWithEnv({
      RATE_LIMIT_AUTH_WINDOW_MS: '1000',
      RATE_LIMIT_AUTH_MAX: '2',
      RATE_LIMIT_REGISTER_WINDOW_MS: 'invalid',
      RATE_LIMIT_REGISTER_MAX: '-1',
    });

    expect(getRateLimitConfig('auth')).toEqual({
      windowMs: 1000,
      limit: 2,
      message: 'Too many login attempts, please try again later',
    });
    expect(getRateLimitConfig('register')).toEqual({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      message: 'Too many account creation attempts, please try again later',
    });
  });

  it('keeps recovery and verification rate limits independently configurable', () => {
    const configured = loadSecurityWithEnv({
      RATE_LIMIT_EMAIL_VERIFICATION_REQUEST_MAX: '4',
      RATE_LIMIT_EMAIL_VERIFICATION_CONFIRMATION_MAX: '8',
      RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX: '3',
      RATE_LIMIT_PASSWORD_RESET_CONFIRMATION_MAX: '7',
      RATE_LIMIT_PASSWORD_RESET_CONFIRMATION_WINDOW_MS: '60000',
    });

    expect(configured.getRateLimitConfig('emailVerificationRequest')).toEqual({
      windowMs: 15 * 60 * 1000,
      limit: 4,
      message: 'Too many email verification requests, please try again later',
    });
    expect(
      configured.getRateLimitConfig('emailVerificationConfirmation'),
    ).toMatchObject({ limit: 8 });
    expect(configured.getRateLimitConfig('passwordResetRequest')).toMatchObject(
      { limit: 3 },
    );
    expect(configured.getRateLimitConfig('passwordResetConfirmation')).toEqual({
      windowMs: 60000,
      limit: 7,
      message: 'Too many password reset attempts, please try again later',
    });
  });

  it('keeps authenticated account-management limits independently configurable', () => {
    const configured = loadSecurityWithEnv({
      RATE_LIMIT_PASSWORD_CHANGE_MAX: '2',
      RATE_LIMIT_EMAIL_CHANGE_REQUEST_MAX: '3',
      RATE_LIMIT_EMAIL_CHANGE_CONFIRMATION_MAX: '4',
      RATE_LIMIT_ACCOUNT_DEACTIVATION_MAX: '1',
      RATE_LIMIT_ACCOUNT_DEACTIVATION_WINDOW_MS: '60000',
    });

    expect(configured.getRateLimitConfig('passwordChange')).toMatchObject({
      limit: 2,
    });
    expect(configured.getRateLimitConfig('emailChangeRequest')).toMatchObject({
      limit: 3,
    });
    expect(
      configured.getRateLimitConfig('emailChangeConfirmation'),
    ).toMatchObject({ limit: 4 });
    expect(configured.getRateLimitConfig('accountDeactivation')).toEqual({
      windowMs: 60000,
      limit: 1,
      message: 'Too many account deactivation attempts, please try again later',
    });
  });

  it('covers local and production defaults through the public configuration API', () => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('JWT_SIGNING_KEYS', '');
    vi.stubEnv('TENANT_HEADER_REQUIRED', 'unexpected');
    vi.stubEnv('CORS_ORIGIN', ' , ');
    vi.stubEnv('RATE_LIMIT_AUTH_WINDOW_MS', '1.5');
    vi.stubEnv('RATE_LIMIT_AUTH_MAX', '0');

    expect(security.getNodeEnv()).toBe('development');
    expect(security.isLocalEnv()).toBe(true);
    expect(security.getJwtSigningKeyRing().activeKid).toBe('local');
    expect(security.isTenantHeaderRequired()).toBe(false);
    expect(security.getAllowedCorsOrigins()).toEqual(['http://localhost:5173']);
    expect(security.getRateLimitConfig('auth')).toEqual({
      windowMs: 1,
      limit: 5,
      message: 'Too many login attempts, please try again later',
    });

    vi.stubEnv('NODE_ENV', 'production');
    expect(security.isLocalEnv()).toBe(false);
    expect(security.isTenantHeaderRequired()).toBe(true);
    expect(security.getAllowedCorsOrigins()).toEqual([]);
    expect(() => security.getJwtSigningKeyRing()).toThrow(/JWT_SIGNING_KEYS/);

    vi.stubEnv('JWT_SIGNING_KEYS', '{"current":"production-secret"}');
    vi.stubEnv('JWT_ACTIVE_KID', 'current');
    vi.stubEnv('TENANT_HEADER_REQUIRED', ' TRUE ');
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example, , https://admin.example');
    expect(security.getJwtSigningKeyRing().activeKid).toBe('current');
    expect(security.isTenantHeaderRequired()).toBe(true);
    expect(security.getAllowedCorsOrigins()).toEqual([
      'https://shop.example',
      'https://admin.example',
    ]);
  });

  it('accepts, rejects, and permits origin-less CORS requests', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const callback = vi.fn();
    const origin = security.getCorsOptions().origin! as (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => void;

    origin(undefined, callback);
    origin('https://shop.example', callback);
    origin('https://attacker.example', callback);

    expect(callback.mock.calls).toEqual([
      [null, true],
      [null, true],
      [null, false],
    ]);
  });

  it('covers the session, cookie, tenant, secret, and CORS decisions in one module instance', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('REFRESH_TOKEN_HASH_SECRETS', '');
    vi.stubEnv('CSRF_SECRETS', '');
    vi.stubEnv('ACCOUNT_TOKEN_HASH_SECRETS', '');
    vi.stubEnv('SESSION_ACCESS_TOKEN_TTL_MS', '');
    vi.stubEnv('SESSION_REFRESH_IDLE_TTL_MS', '');
    vi.stubEnv('SESSION_ABSOLUTE_TTL_MS', '');
    vi.stubEnv('SESSION_REFRESH_CONCURRENCY_WINDOW_MS', '');
    vi.stubEnv('TENANT_HEADER_REQUIRED', 'unexpected');
    vi.stubEnv('CORS_ORIGIN', '');

    expect(security.getRefreshTokenHashKeyRing().activeVersion).toBe('local');
    expect(security.getCsrfSecretKeyRing().activeVersion).toBe('local');
    expect(security.getAccountTokenHashKeyRing().activeVersion).toBe('local');
    expect(security.getSessionSecurityConfig().accessTokenTtlMs).toBe(300000);
    expect(security.getAuthCookieConfig().access.name).toBe('mz_at');
    expect(security.isTenantHeaderRequired()).toBe(false);
    expect(security.getAllowedCorsOrigins()).toEqual(['http://localhost:5173']);
    expect(() => security.validateSecurityConfig()).not.toThrow();

    vi.stubEnv(
      'REFRESH_TOKEN_HASH_SECRETS',
      '{"current":"refresh-configured"}',
    );
    vi.stubEnv('REFRESH_TOKEN_HASH_ACTIVE_VERSION', 'current');
    vi.stubEnv('CSRF_SECRETS', '{"current":"csrf-configured"}');
    vi.stubEnv('CSRF_ACTIVE_VERSION', 'current');
    vi.stubEnv(
      'ACCOUNT_TOKEN_HASH_SECRETS',
      '{"current":"account-token-configured"}',
    );
    vi.stubEnv('ACCOUNT_TOKEN_HASH_ACTIVE_VERSION', 'current');
    vi.stubEnv('SESSION_ACCESS_TOKEN_TTL_MS', '60000');
    vi.stubEnv('SESSION_REFRESH_IDLE_TTL_MS', '3600000');
    vi.stubEnv('SESSION_ABSOLUTE_TTL_MS', '86400000');
    vi.stubEnv('SESSION_REFRESH_CONCURRENCY_WINDOW_MS', '1000');
    vi.stubEnv('TENANT_HEADER_REQUIRED', 'false');
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');

    expect(security.getRefreshTokenHashKeyRing().activeVersion).toBe('current');
    expect(security.getCsrfSecretKeyRing().activeVersion).toBe('current');
    expect(security.getAccountTokenHashKeyRing().activeVersion).toBe('current');
    expect(security.getSessionSecurityConfig()).toEqual({
      accessTokenTtlMs: 60000,
      refreshIdleTtlMs: 3600000,
      absoluteTtlMs: 86400000,
      refreshConcurrencyWindowMs: 1000,
    });
    expect(security.isTenantHeaderRequired()).toBe(false);
    expect(security.getAllowedCorsOrigins()).toEqual(['https://shop.example']);

    vi.stubEnv('TENANT_HEADER_REQUIRED', 'true');
    expect(security.isTenantHeaderRequired()).toBe(true);

    vi.stubEnv('SESSION_ACCESS_TOKEN_TTL_MS', 'not-an-integer');
    expect(() => security.getSessionSecurityConfig()).toThrow(
      'SESSION_ACCESS_TOKEN_TTL_MS must be an integer',
    );

    vi.stubEnv('SESSION_ACCESS_TOKEN_TTL_MS', '60000');
    vi.stubEnv('SESSION_REFRESH_IDLE_TTL_MS', '172800000');
    vi.stubEnv('SESSION_ABSOLUTE_TTL_MS', '86400000');
    expect(() => security.getSessionSecurityConfig()).toThrow(
      'SESSION_ABSOLUTE_TTL_MS must be greater than or equal',
    );

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_REFRESH_IDLE_TTL_MS', '3600000');
    expect(security.getAuthCookieConfig().access.name).toBe('__Host-mz_at');
    vi.stubEnv('REFRESH_TOKEN_HASH_SECRETS', '');
    vi.stubEnv('CSRF_SECRETS', '');
    vi.stubEnv('ACCOUNT_TOKEN_HASH_SECRETS', '');
    expect(() => security.getRefreshTokenHashKeyRing()).toThrow(
      'REFRESH_TOKEN_HASH_SECRETS',
    );
    expect(() => security.getCsrfSecretKeyRing()).toThrow('CSRF_SECRETS');
    expect(() => security.getAccountTokenHashKeyRing()).toThrow(
      'ACCOUNT_TOKEN_HASH_SECRETS',
    );
  });
});
