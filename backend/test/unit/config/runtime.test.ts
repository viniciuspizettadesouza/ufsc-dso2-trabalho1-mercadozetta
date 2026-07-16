import { afterEach, describe, expect, it } from 'vitest';
import { getRuntimeConfig, getTrustProxyHops } from '@/config/runtime';

describe('runtime config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses local port and proxy defaults', () => {
    process.env = {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/mercadozetta',
    };

    expect(getRuntimeConfig()).toEqual({
      mongoUri: 'mongodb://localhost:27017/mercadozetta',
      port: 3333,
      trustProxyHops: 0,
    });
  });

  it('accepts complete production runtime configuration', () => {
    process.env = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://mongo:27017/mercadozetta',
      PORT: '4000',
      TRUST_PROXY_HOPS: '1',
      CORS_ORIGIN: 'https://market.example.com,https://admin.example.com',
    };

    expect(getRuntimeConfig()).toEqual({
      mongoUri: 'mongodb://mongo:27017/mercadozetta',
      port: 4000,
      trustProxyHops: 1,
    });
  });

  it('rejects missing production variables and invalid values', () => {
    process.env = { NODE_ENV: 'production' };
    expect(() => getRuntimeConfig()).toThrow('MONGODB_URI');

    process.env.MONGODB_URI = 'mongodb://mongo:27017/mercadozetta';
    expect(() => getRuntimeConfig()).toThrow('TRUST_PROXY_HOPS');

    process.env.TRUST_PROXY_HOPS = '1';
    expect(() => getRuntimeConfig()).toThrow('CORS_ORIGIN');

    process.env.CORS_ORIGIN = 'not-an-origin';
    expect(() => getRuntimeConfig()).toThrow('invalid origin');

    process.env.CORS_ORIGIN = 'ftp://market.example.com';
    expect(() => getRuntimeConfig()).toThrow('invalid origin');

    process.env.CORS_ORIGIN = 'https://market.example.com/path';
    expect(() => getRuntimeConfig()).toThrow('invalid origin');

    process.env.CORS_ORIGIN = 'https://market.example.com';
    expect(() => getRuntimeConfig()).toThrow('PORT');
  });

  it('rejects invalid ports and proxy hop counts', () => {
    process.env = {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/mercadozetta',
      PORT: '70000',
      TRUST_PROXY_HOPS: '11',
    };

    expect(() => getRuntimeConfig()).toThrow('PORT');
    process.env.PORT = '3333';
    expect(() => getRuntimeConfig()).toThrow('TRUST_PROXY_HOPS');

    process.env.TRUST_PROXY_HOPS = '-1';
    expect(() => getTrustProxyHops()).toThrow('TRUST_PROXY_HOPS');
  });
});
