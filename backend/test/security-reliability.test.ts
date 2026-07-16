import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const mongoose = require('mongoose');
const request = require('supertest');

const modulePaths = [
  '@/app',
  '@/routes',
  '@/config/security',
  '@/middleware/asyncHandler',
  '@/middleware/auth',
  '@/middleware/errorHandler',
  '@/middleware/rateLimit',
  '@/middleware/requestContext',
  '@/middleware/tenant',
  '@/middleware/validateRequest',
];

const originalEnv = { ...process.env };

function clearModules() {
  modulePaths.forEach((path) => {
    delete require.cache[require.resolve(path)];
  });
}

function loadApp() {
  clearModules();
  return require('@/app');
}

function loadSecurityConfig() {
  clearModules();
  return require('@/config/security');
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
  };
  delete process.env.CORS_ORIGIN;
  delete process.env.JWT_SIGNING_KEYS;
  delete process.env.JWT_ACTIVE_KID;
  delete process.env.RATE_LIMIT_AUTH_MAX;
  delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;
  delete process.env.RATE_LIMIT_REGISTER_MAX;
  delete process.env.RATE_LIMIT_REGISTER_WINDOW_MS;
});

afterEach(() => {
  process.env = { ...originalEnv };
  clearModules();
});

describe('security and reliability middleware', () => {
  it('adds security headers and a request id to health responses', async () => {
    const app = loadApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('preserves incoming request ids for correlation', async () => {
    const app = loadApp();

    const response = await request(app)
      .get('/health')
      .set('X-Request-Id', 'request-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('request-123');
  });

  it('reports readiness from the MongoDB connection state', async () => {
    const app = loadApp();
    const isReady = mongoose.connection.readyState === 1;

    const response = await request(app).get('/ready');

    expect(response.status).toBe(isReady ? 200 : 503);
    expect(response.body).toEqual({
      status: isReady ? 'ready' : 'not_ready',
      checks: {
        mongodb: isReady ? 'connected' : 'disconnected',
      },
    });
  });

  it('allows only configured CORS origins', async () => {
    process.env.CORS_ORIGIN = 'https://market.example.com';
    const app = loadApp();

    const allowedResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://market.example.com');
    const blockedResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://unknown.example.com');

    expect(allowedResponse.headers['access-control-allow-origin']).toBe(
      'https://market.example.com',
    );
    expect(
      blockedResponse.headers['access-control-allow-origin'],
    ).toBeUndefined();
  });

  it('rate limits repeated login attempts', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '2';
    process.env.RATE_LIMIT_AUTH_WINDOW_MS = '60000';
    const app = loadApp();

    const firstResponse = await request(app).post('/auth/login').send({});
    const secondResponse = await request(app).post('/auth/login').send({});
    const thirdResponse = await request(app).post('/auth/login').send({});

    expect(firstResponse.status).toBe(400);
    expect(secondResponse.status).toBe(400);
    expect(thirdResponse.status).toBe(429);
    expect(thirdResponse.body).toEqual({
      error: 'Too many login attempts, please try again later',
      code: 'AUTH_RATE_LIMITED',
    });
  });

  it('requires the JWT signing key ring outside development and test', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SIGNING_KEYS;
    const { getJwtSigningKeyRing } = loadSecurityConfig();

    expect(() => getJwtSigningKeyRing()).toThrow(
      'JWT_SIGNING_KEYS is required outside development and test',
    );
  });

  it('keeps a local JWT signing fallback only for development and test', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SIGNING_KEYS;
    const { getJwtSigningKeyRing } = loadSecurityConfig();

    expect(getJwtSigningKeyRing()).toEqual({
      activeKid: 'local',
      keys: { local: 'mercadozetta-dev-secret' },
    });
  });

  it('returns a consistent error for malformed JSON payloads', async () => {
    const app = loadApp();

    const response = await request(app)
      .post('/users')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Invalid JSON payload' });
  });
});
