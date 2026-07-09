import { afterEach, describe, expect, it, vi } from 'vitest';

const securityPath = require.resolve('../../../src/config/security');

function loadSecurityWithEnv(env = {}) {
    delete require.cache[securityPath];
    process.env = {
        ...env,
    };
    return require('../../../src/config/security');
}

describe('security config', () => {
    const originalEnv = process.env;

    afterEach(() => {
        process.env = originalEnv;
        delete require.cache[securityPath];
    });

    it('uses an explicit JWT secret when configured', () => {
        const { getJwtSecret } = loadSecurityWithEnv({
            NODE_ENV: 'production',
            JWT_SECRET: 'configured-secret',
        });

        expect(getJwtSecret()).toBe('configured-secret');
    });

    it('uses the development fallback secret only in local environments', () => {
        expect(loadSecurityWithEnv({ NODE_ENV: 'test' }).getJwtSecret()).toBe('mercadozetta-dev-secret');
        expect(loadSecurityWithEnv({ NODE_ENV: 'development' }).getJwtSecret()).toBe('mercadozetta-dev-secret');
    });

    it('requires JWT_SECRET outside local environments', () => {
        const { getJwtSecret } = loadSecurityWithEnv({ NODE_ENV: 'production' });

        expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is required outside development and test');
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
});
