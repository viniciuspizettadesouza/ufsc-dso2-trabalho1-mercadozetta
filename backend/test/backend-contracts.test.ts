import { beforeEach, describe, expect, it, vi } from 'vitest';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../src/app');
const authMiddleware = require('../src/middleware/auth');
const Product = require('../src/model/product');
const routes = require('../src/routes');
const User = require('../src/model/user');

function findRoute(path: string, method: string) {
    return routes.stack.find((layer: any) => (
        layer.route
        && layer.route.path === path
        && layer.route.methods[method]
    ));
}

function createResponse(): {
    statusCode: number | null;
    body: NodeModule['exports'];
    status: (code: number) => ReturnType<typeof createResponse>;
    send: (payload: NodeModule['exports']) => ReturnType<typeof createResponse>;
} {
    return {
        statusCode: null,
        body: null,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send(payload: NodeModule['exports']) {
            this.body = payload;
            return this;
        },
    };
}

describe('app and route composition', () => {
    it('mounts JSON middleware before routes', async () => {
        const response = await request(app)
            .post('/users')
            .set('Content-Type', 'application/json')
            .send('{"email":');

        expect(response.status).toBe(400);
    });

    it('exposes canonical public and authenticated routes', () => {
        expect(findRoute('/', 'get')).toBeDefined();
        expect(findRoute('/health', 'get')).toBeDefined();
        expect(findRoute('/ready', 'get')).toBeDefined();
        expect(findRoute('/products', 'get')).toBeDefined();
        expect(findRoute('/products/:productId', 'get')).toBeDefined();
        expect(findRoute('/users/:userId', 'get')).toBeDefined();
        expect(findRoute('/users/:userId/products', 'get')).toBeDefined();
        expect(findRoute('/users', 'post')).toBeDefined();
        expect(findRoute('/auth/login', 'post')).toBeDefined();
        expect(findRoute('/products', 'post')).toBeDefined();
    });

    it('protects product creation with auth middleware before the controller', () => {
        const productPostRoute = findRoute('/products', 'post');
        const handlers = productPostRoute.route.stack.map((layer: any) => layer.handle.name);

        expect(handlers).toEqual(['authMiddleware', 'requestValidator', 'wrappedHandler']);
    });
});

describe('auth middleware', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = 'contract-test-secret';
    });

    it('rejects requests without authorization header', () => {
        const req = { headers: {} };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'AUTH_TOKEN_REQUIRED',
            message: 'Authorization token is required',
        }));
    });

    it('rejects invalid bearer format', () => {
        const req = { headers: { authorization: 'Basic abc' } };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_FORMAT',
            message: 'Invalid authorization format',
        }));
    });

    it('rejects bearer headers without a token', () => {
        const req = { headers: { authorization: 'Bearer' } };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_FORMAT',
            message: 'Invalid authorization format',
        }));
    });

    it('rejects invalid tokens', () => {
        const req = { headers: { authorization: 'Bearer invalid-token' } };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_TOKEN',
            message: 'Invalid authorization token',
        }));
    });

    it('rejects expired tokens', () => {
        const token = jwt.sign(
            { id: 'user-123' },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' }
        );
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_TOKEN',
            message: 'Invalid authorization token',
        }));
    });

    it('sets req.userId and calls next for valid tokens', () => {
        const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);
        const req: { headers: { authorization: string }; userId?: string } = {
            headers: { authorization: `Bearer ${token}` },
        };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(req.userId).toBe('user-123');
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
    });

    it('rejects tokens issued for another tenant', () => {
        const token = jwt.sign(
            { id: 'user-123', tenantId: 'campus-market' },
            process.env.JWT_SECRET
        );
        const req = {
            headers: { authorization: `Bearer ${token}` },
            tenant: { id: 'mercadozetta' },
        };
        const res = createResponse();
        const next = vi.fn();

        authMiddleware(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            code: 'INVALID_AUTH_TOKEN',
            message: 'Invalid authorization token',
        }));
    });
});

describe('model contracts', () => {
    it('keeps user password excluded by default', () => {
        expect(User.schema.path('password').options.select).toBe(false);
    });

    it('keeps tenant-aware user email uniqueness', () => {
        expect(User.schema.indexes()).toContainEqual([
            { tenantId: 1, email: 1 },
            expect.objectContaining({ unique: true }),
        ]);
    });

    it('hashes user password before save when password changes', async () => {
        const passwordHook = User.schema.s.hooks._pres
            .get('save')
            .find((hook: any) => hook.fn.toString().includes('isModified'));
        const hashSpy = vi.spyOn(bcrypt, 'hash');
        const doc = {
            password: 'plain-secret',
            isModified: vi.fn(() => true),
        };

        await passwordHook.fn.call(doc);

        expect(doc.isModified).toHaveBeenCalledWith('password');
        expect(hashSpy).toHaveBeenCalledWith('plain-secret', 10);
        expect(doc.password).not.toBe('plain-secret');
        expect(await bcrypt.compare('plain-secret', doc.password)).toBe(true);

        hashSpy.mockRestore();
    });

    it('does not rehash unchanged user passwords', async () => {
        const passwordHook = User.schema.s.hooks._pres
            .get('save')
            .find((hook: any) => hook.fn.toString().includes('isModified'));
        const hashSpy = vi.spyOn(bcrypt, 'hash');
        const doc = {
            password: 'already-hashed',
            isModified: vi.fn(() => false),
        };

        await passwordHook.fn.call(doc);

        expect(doc.password).toBe('already-hashed');
        expect(hashSpy).not.toHaveBeenCalled();

        hashSpy.mockRestore();
    });

    it('requires product name, inventory, image, and seller', async () => {
        const product = new Product({});

        await expect(product.validate()).rejects.toMatchObject({
            errors: {
                name: expect.any(Object),
                inventory: expect.any(Object),
                image: expect.any(Object),
                seller: expect.any(Object),
            },
        });
    });

    it('restricts products to known statuses', () => {
        expect(Product.schema.path('status').enumValues).toEqual([
            'draft',
            'active',
            'paused',
            'sold_out',
            'archived',
        ]);
        expect(Product.schema.path('status').defaultValue).toBe('active');
    });

    it('keeps product tenant indexes and timestamps', () => {
        expect(Product.schema.indexes()).toContainEqual([
            { tenantId: 1, seller: 1 },
            expect.any(Object),
        ]);
        expect(Product.schema.indexes()).toContainEqual([
            { tenantId: 1, category: 1, subcategory: 1 },
            expect.any(Object),
        ]);
        expect(Product.schema.indexes()).toContainEqual([
            { tenantId: 1, name: 'text', description: 'text' },
            expect.any(Object),
        ]);
        expect(Product.schema.options.timestamps).toBe(true);
    });
});
