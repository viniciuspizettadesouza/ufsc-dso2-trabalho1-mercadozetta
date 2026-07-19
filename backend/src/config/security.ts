import type { CorsOptions } from 'cors';
import type { CookieOptions } from 'express';

const DEFAULT_DEV_JWT_SECRET = 'mercadozetta-dev-secret';
const DEFAULT_DEV_REFRESH_TOKEN_HASH_SECRET =
  'mercadozetta-dev-refresh-token-hash-secret';
const DEFAULT_DEV_CSRF_SECRET = 'mercadozetta-dev-csrf-secret';
const DEFAULT_DEV_ACCOUNT_TOKEN_HASH_SECRET =
  'mercadozetta-dev-account-token-hash-secret';
const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173'];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type AuthCookieConfig = {
  name: string;
  options: CookieOptions;
};

export type SessionSecurityConfig = {
  accessTokenTtlMs: number;
  refreshIdleTtlMs: number;
  absoluteTtlMs: number;
  refreshConcurrencyWindowMs: number;
};

export type AccountSecurityConfig = {
  emailVerificationTokenTtlMs: number;
  passwordResetTokenTtlMs: number;
  emailChangeTokenTtlMs: number;
  requestResponseFloorMs: number;
  issueCooldownMs: number;
  issueWindowMs: number;
  issueMax: number;
};

type RateLimitConfig = {
  windowMs: number;
  limit: number;
  message: string;
};

export type SecretKeyRing = {
  activeVersion: string;
  keys: Record<string, string>;
};

export type JwtSigningKeyRing = {
  activeKid: string;
  keys: Record<string, string>;
};

const SECRET_VERSION_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export function getNodeEnv() {
  return process.env.NODE_ENV || 'development';
}

export function isLocalEnv() {
  return ['development', 'test'].includes(getNodeEnv());
}

function parseList(value: string | undefined) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSecretMap(name: string) {
  const configured = process.env[name]?.trim();
  if (!configured) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(configured);
  } catch {
    throw new Error(`${name} must be a JSON object of versioned secrets`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object of versioned secrets`);
  }

  const entries = Object.entries(parsed);
  if (
    !entries.length ||
    entries.some(
      ([version, secret]) =>
        !SECRET_VERSION_PATTERN.test(version) ||
        typeof secret !== 'string' ||
        !secret.trim(),
    )
  ) {
    throw new Error(`${name} contains an invalid version or secret`);
  }

  return Object.fromEntries(
    entries.map(([version, secret]) => [version, String(secret)]),
  );
}

function getVersionedSecretRing(
  keysName: string,
  activeName: string,
  localFallback: string,
): SecretKeyRing {
  const keys = parseSecretMap(keysName);
  if (!keys) {
    if (isLocalEnv()) {
      return { activeVersion: 'local', keys: { local: localFallback } };
    }
    throw new Error(`${keysName} is required outside development and test`);
  }

  const activeVersion = process.env[activeName]?.trim();
  if (!activeVersion || !keys[activeVersion]) {
    throw new Error(
      `${activeName} must select a key configured in ${keysName}`,
    );
  }

  return { activeVersion, keys };
}

export function getJwtSigningKeyRing(): JwtSigningKeyRing {
  const ring = getVersionedSecretRing(
    'JWT_SIGNING_KEYS',
    'JWT_ACTIVE_KID',
    DEFAULT_DEV_JWT_SECRET,
  );
  return { activeKid: ring.activeVersion, keys: ring.keys };
}

export function getRefreshTokenHashKeyRing() {
  return getVersionedSecretRing(
    'REFRESH_TOKEN_HASH_SECRETS',
    'REFRESH_TOKEN_HASH_ACTIVE_VERSION',
    DEFAULT_DEV_REFRESH_TOKEN_HASH_SECRET,
  );
}

export function getCsrfSecretKeyRing() {
  return getVersionedSecretRing(
    'CSRF_SECRETS',
    'CSRF_ACTIVE_VERSION',
    DEFAULT_DEV_CSRF_SECRET,
  );
}

export function getAccountTokenHashKeyRing() {
  return getVersionedSecretRing(
    'ACCOUNT_TOKEN_HASH_SECRETS',
    'ACCOUNT_TOKEN_HASH_ACTIVE_VERSION',
    DEFAULT_DEV_ACCOUNT_TOKEN_HASH_SECRET,
  );
}

export function validateSecurityConfig() {
  getJwtSigningKeyRing();
  getRefreshTokenHashKeyRing();
  getCsrfSecretKeyRing();
  getAccountTokenHashKeyRing();
  getSessionSecurityConfig();
  getAccountSecurityConfig();
}

function readBoundedDuration(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const configured = process.env[name]?.trim();
  /* v8 ignore else */
  if (!configured) return fallback;

  const value = Number(configured);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return value;
}

export function getSessionSecurityConfig(): SessionSecurityConfig {
  const refreshIdleTtlMs = readBoundedDuration(
    'SESSION_REFRESH_IDLE_TTL_MS',
    7 * DAY_MS,
    HOUR_MS,
    30 * DAY_MS,
  );
  const absoluteTtlMs = readBoundedDuration(
    'SESSION_ABSOLUTE_TTL_MS',
    30 * DAY_MS,
    DAY_MS,
    90 * DAY_MS,
  );

  /* v8 ignore else */
  if (absoluteTtlMs < refreshIdleTtlMs) {
    throw new Error(
      'SESSION_ABSOLUTE_TTL_MS must be greater than or equal to SESSION_REFRESH_IDLE_TTL_MS',
    );
  }

  return {
    accessTokenTtlMs: readBoundedDuration(
      'SESSION_ACCESS_TOKEN_TTL_MS',
      5 * MINUTE_MS,
      MINUTE_MS,
      15 * MINUTE_MS,
    ),
    refreshIdleTtlMs,
    absoluteTtlMs,
    refreshConcurrencyWindowMs: readBoundedDuration(
      'SESSION_REFRESH_CONCURRENCY_WINDOW_MS',
      5 * 1000,
      1000,
      10 * 1000,
    ),
  };
}

export function getAccountSecurityConfig(): AccountSecurityConfig {
  const issueCooldownMs = readBoundedDuration(
    'ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS',
    MINUTE_MS,
    1000,
    15 * MINUTE_MS,
  );
  const issueWindowMs = readBoundedDuration(
    'ACCOUNT_TOKEN_ISSUE_WINDOW_MS',
    HOUR_MS,
    MINUTE_MS,
    DAY_MS,
  );

  if (issueWindowMs < issueCooldownMs) {
    throw new Error(
      'ACCOUNT_TOKEN_ISSUE_WINDOW_MS must be greater than or equal to ACCOUNT_TOKEN_ISSUE_COOLDOWN_MS',
    );
  }

  return {
    emailVerificationTokenTtlMs: readBoundedDuration(
      'EMAIL_VERIFICATION_TOKEN_TTL_MS',
      8 * HOUR_MS,
      5 * MINUTE_MS,
      DAY_MS,
    ),
    passwordResetTokenTtlMs: readBoundedDuration(
      'PASSWORD_RESET_TOKEN_TTL_MS',
      30 * MINUTE_MS,
      5 * MINUTE_MS,
      2 * HOUR_MS,
    ),
    emailChangeTokenTtlMs: readBoundedDuration(
      'EMAIL_CHANGE_TOKEN_TTL_MS',
      30 * MINUTE_MS,
      5 * MINUTE_MS,
      2 * HOUR_MS,
    ),
    requestResponseFloorMs: readBoundedDuration(
      'ACCOUNT_REQUEST_RESPONSE_FLOOR_MS',
      500,
      100,
      2000,
    ),
    issueCooldownMs,
    issueWindowMs,
    issueMax: readBoundedDuration('ACCOUNT_TOKEN_ISSUE_MAX', 3, 1, 10),
  };
}

function getCookieOptions(maxAge: number, httpOnly: boolean): CookieOptions {
  return {
    httpOnly,
    secure: !isLocalEnv(),
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function getAuthCookieConfig(): {
  access: AuthCookieConfig;
  refresh: AuthCookieConfig;
  csrf: AuthCookieConfig;
} {
  const session = getSessionSecurityConfig();
  const productionNames = !isLocalEnv();

  return {
    access: {
      name: productionNames ? '__Host-mz_at' : 'mz_at',
      options: getCookieOptions(session.accessTokenTtlMs, true),
    },
    refresh: {
      name: productionNames ? '__Secure-mz_rt' : 'mz_rt',
      options: {
        ...getCookieOptions(session.refreshIdleTtlMs, true),
        path: '/auth',
      },
    },
    csrf: {
      name: productionNames ? '__Host-mz_csrf' : 'mz_csrf',
      options: getCookieOptions(session.refreshIdleTtlMs, false),
    },
  };
}

export function isTenantHeaderRequired() {
  const configured = process.env.TENANT_HEADER_REQUIRED?.trim().toLowerCase();

  if (configured === 'true') return true;

  /* v8 ignore else */
  if (configured === 'false') return false;

  return !isLocalEnv();
}

export function getAllowedCorsOrigins() {
  const configuredOrigins = parseList(process.env.CORS_ORIGIN);

  if (configuredOrigins.length) return configuredOrigins;

  return isLocalEnv() ? DEFAULT_DEV_CORS_ORIGINS : [];
}

export function getCorsOptions(): CorsOptions {
  const allowedOrigins = getAllowedCorsOrigins();

  return {
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Tenant-Id', 'X-CSRF-Token'],
    origin(origin, callback) {
      /* v8 ignore else */
      if (!origin) return callback(null, true);

      return callback(null, allowedOrigins.includes(origin));
    },
  };
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || '', 10);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export type RateLimitScope =
  | 'register'
  | 'auth'
  | 'emailVerificationRequest'
  | 'emailVerificationConfirmation'
  | 'passwordResetRequest'
  | 'passwordResetConfirmation'
  | 'passwordChange'
  | 'emailChangeRequest'
  | 'emailChangeConfirmation'
  | 'accountDeactivation';

const rateLimitDefinitions: Record<
  RateLimitScope,
  { prefix: string; limit: number; message: string }
> = {
  register: {
    prefix: 'RATE_LIMIT_REGISTER',
    limit: 10,
    message: 'Too many account creation attempts, please try again later',
  },
  auth: {
    prefix: 'RATE_LIMIT_AUTH',
    limit: 5,
    message: 'Too many login attempts, please try again later',
  },
  emailVerificationRequest: {
    prefix: 'RATE_LIMIT_EMAIL_VERIFICATION_REQUEST',
    limit: 5,
    message: 'Too many email verification requests, please try again later',
  },
  emailVerificationConfirmation: {
    prefix: 'RATE_LIMIT_EMAIL_VERIFICATION_CONFIRMATION',
    limit: 10,
    message: 'Too many email verification attempts, please try again later',
  },
  passwordResetRequest: {
    prefix: 'RATE_LIMIT_PASSWORD_RESET_REQUEST',
    limit: 5,
    message: 'Too many password reset requests, please try again later',
  },
  passwordResetConfirmation: {
    prefix: 'RATE_LIMIT_PASSWORD_RESET_CONFIRMATION',
    limit: 10,
    message: 'Too many password reset attempts, please try again later',
  },
  passwordChange: {
    prefix: 'RATE_LIMIT_PASSWORD_CHANGE',
    limit: 5,
    message: 'Too many password change attempts, please try again later',
  },
  emailChangeRequest: {
    prefix: 'RATE_LIMIT_EMAIL_CHANGE_REQUEST',
    limit: 5,
    message: 'Too many email change attempts, please try again later',
  },
  emailChangeConfirmation: {
    prefix: 'RATE_LIMIT_EMAIL_CHANGE_CONFIRMATION',
    limit: 10,
    message: 'Too many email change confirmations, please try again later',
  },
  accountDeactivation: {
    prefix: 'RATE_LIMIT_ACCOUNT_DEACTIVATION',
    limit: 5,
    message: 'Too many account deactivation attempts, please try again later',
  },
};

export function getRateLimitConfig(scope: RateLimitScope): RateLimitConfig {
  const definition = rateLimitDefinitions[scope];

  return {
    windowMs: readPositiveInteger(
      `${definition.prefix}_WINDOW_MS`,
      15 * MINUTE_MS,
    ),
    limit: readPositiveInteger(`${definition.prefix}_MAX`, definition.limit),
    message: definition.message,
  };
}
