import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const authPath = require.resolve('../../../src/middleware/auth');
const securityPath = require.resolve('../../../src/config/security');

function loadAuthMiddleware(secret = 'test-secret') {
    clearModules(authPath, securityPath);
    mockModule(securityPath, {
        getJwtSecret: () => secret,
    });
    return require('../../../src/middleware/auth');
}

afterEach(() => {
    clearModules(authPath, securityPath);
    vi.restoreAllMocks();
});

describe('auth middleware', () => {
    it('rejects missing authorization headers', () => {
        const authMiddleware = loadAuthMiddleware();
        const next = vi.fn();

        authMiddleware({ headers: {} }, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'AUTH_TOKEN_REQUIRED',
        }));
    });

    it('rejects malformed authorization headers', () => {
        const authMiddleware = loadAuthMiddleware();
        const next = vi.fn();

        authMiddleware({ headers: { authorization: 'Token abc' } }, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_FORMAT',
        }));
    });

    it('sets req.userId for valid tokens', () => {
        const authMiddleware = loadAuthMiddleware();
        const token = jwt.sign({ id: 'user-1', tenantId: 'mercadozetta' }, 'test-secret');
        const req: any = {
            headers: { authorization: `Bearer ${token}` },
            tenant: { id: 'mercadozetta' },
        };
        const next = vi.fn();

        authMiddleware(req, {}, next);

        expect(req.userId).toBe('user-1');
        expect(next).toHaveBeenCalledWith();
    });

    it('rejects valid tokens from another tenant', () => {
        const authMiddleware = loadAuthMiddleware();
        const token = jwt.sign({ id: 'user-1', tenantId: 'campus-market' }, 'test-secret');
        const req = {
            headers: { authorization: `Bearer ${token}` },
            tenant: { id: 'mercadozetta' },
        };
        const next = vi.fn();

        authMiddleware(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_TOKEN',
        }));
    });

    it('rejects tokens that cannot be verified', () => {
        const authMiddleware = loadAuthMiddleware();
        const req = {
            headers: { authorization: 'Bearer invalid-token' },
            tenant: { id: 'mercadozetta' },
        };
        const next = vi.fn();

        authMiddleware(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_TOKEN',
        }));
    });
});
