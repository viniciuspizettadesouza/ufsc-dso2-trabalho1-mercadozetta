import { afterEach, describe, expect, it, vi } from 'vitest';
import * as security from '../../../src/config/security';

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

    it('uses short-lived access tokens by default and accepts a configured TTL', () => {
        expect(loadSecurityWithEnv({}).getJwtAccessTokenTtl()).toBe('15m');
        expect(loadSecurityWithEnv({ JWT_ACCESS_TOKEN_TTL: '30m' }).getJwtAccessTokenTtl()).toBe('30m');
    });

    it('requires tenant headers outside local environments unless explicitly configured', () => {
        expect(loadSecurityWithEnv({ NODE_ENV: 'production' }).isTenantHeaderRequired()).toBe(true);
        expect(loadSecurityWithEnv({ NODE_ENV: 'development' }).isTenantHeaderRequired()).toBe(false);
        expect(loadSecurityWithEnv({ NODE_ENV: 'production', TENANT_HEADER_REQUIRED: 'false' }).isTenantHeaderRequired()).toBe(false);
        expect(loadSecurityWithEnv({ NODE_ENV: 'test', TENANT_HEADER_REQUIRED: 'true' }).isTenantHeaderRequired()).toBe(true);
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

    it('covers local and production defaults through the public configuration API', () => {
        vi.stubEnv('NODE_ENV', '');
        vi.stubEnv('JWT_SECRET', '');
        vi.stubEnv('JWT_ACCESS_TOKEN_TTL', '   ');
        vi.stubEnv('TENANT_HEADER_REQUIRED', 'unexpected');
        vi.stubEnv('CORS_ORIGIN', ' , ');
        vi.stubEnv('RATE_LIMIT_AUTH_WINDOW_MS', '1.5');
        vi.stubEnv('RATE_LIMIT_AUTH_MAX', '0');

        expect(security.getNodeEnv()).toBe('development');
        expect(security.isLocalEnv()).toBe(true);
        expect(security.getJwtSecret()).toBe('mercadozetta-dev-secret');
        expect(security.getJwtAccessTokenTtl()).toBe('15m');
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
        expect(() => security.getJwtSecret()).toThrow(/JWT_SECRET/);

        vi.stubEnv('JWT_SECRET', 'production-secret');
        vi.stubEnv('JWT_ACCESS_TOKEN_TTL', ' 30m ');
        vi.stubEnv('TENANT_HEADER_REQUIRED', ' TRUE ');
        vi.stubEnv('CORS_ORIGIN', 'https://shop.example, , https://admin.example');
        expect(security.getJwtSecret()).toBe('production-secret');
        expect(security.getJwtAccessTokenTtl()).toBe('30m');
        expect(security.isTenantHeaderRequired()).toBe(true);
        expect(security.getAllowedCorsOrigins()).toEqual(['https://shop.example', 'https://admin.example']);
    });

    it('accepts, rejects, and permits origin-less CORS requests', () => {
        vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
        const callback = vi.fn();
        const origin = security.getCorsOptions().origin! as (
            origin: string | undefined,
            callback: (error: Error | null, allowed?: boolean) => void
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
});
