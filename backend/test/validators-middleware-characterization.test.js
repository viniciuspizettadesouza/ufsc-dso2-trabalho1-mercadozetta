const AppError = require('../src/errors/AppError');
const asyncHandler = require('../src/middleware/asyncHandler');
const errorHandler = require('../src/middleware/errorHandler');
const requestContext = require('../src/middleware/requestContext');
const tenantMiddleware = require('../src/middleware/tenant');
const validateRequest = require('../src/middleware/validateRequest');
const { getAllowedCorsOrigins, getCorsOptions, getJwtSecret, getRateLimitConfig } = require('../src/config/security');
const { validateLoginPayload } = require('../src/validators/authValidator');
const { validateCreateProductPayload, validateProductFilters, validateProductId, validateSellerId } = require('../src/validators/productValidator');
const { validateCreateUserPayload } = require('../src/validators/userValidator');

const originalEnv = { ...process.env };

function createResponse() {
    return {
        headers: {},
        headersSent: false,
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(payload) {
            this.body = payload;
            return this;
        },
        setHeader(name, value) {
            this.headers[name] = value;
        },
        on: vi.fn(),
    };
}

afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
});

describe('validator characterization', () => {
    it('normalizes valid login payloads and rejects missing credentials', () => {
        expect(validateLoginPayload({
            email: ' Seller@Example.com ',
            password: ' secret123 ',
        })).toEqual({
            email: 'seller@example.com',
            password: ' secret123 ',
        });

        expect(() => validateLoginPayload({ email: 'seller@example.com' })).toThrow(AppError);
        expect(() => validateLoginPayload({ password: 'secret123' })).toThrow(AppError);
    });

    it('normalizes valid user payloads and rejects invalid input', () => {
        expect(validateCreateUserPayload({
            email: ' Buyer@Example.com ',
            password: 'secret123',
            username: ' Buyer ',
            telephone: ' 999 ',
        })).toEqual({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        });

        expect(() => validateCreateUserPayload({
            email: 'invalid-email',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        })).toThrow(AppError);
        expect(() => validateCreateUserPayload({
            email: 'buyer@example.com',
            password: 'short',
            username: 'Buyer',
            telephone: '999',
        })).toThrow(AppError);
        expect(() => validateCreateUserPayload({
            email: 'buyer@example.com',
            password: 'secret123',
        })).toThrow(AppError);
    });

    it('normalizes product payloads, defaults optional fields, and validates ids', () => {
        expect(validateCreateProductPayload({
            name: ' Bike ',
            description: ' Fast ',
            category: ' Sports ',
            subcategory: ' Bikes ',
            quant: '2',
            image: ' bike.png ',
        })).toEqual({
            name: 'Bike',
            description: 'Fast',
            category: 'sports',
            subcategory: 'bikes',
            inventory: 2,
            image: 'bike.png',
            status: 'active',
        });

        expect(validateCreateProductPayload({
            name: 'Bike',
            inventory: 0,
            image: 'bike.png',
            status: 'draft',
        })).toMatchObject({
            category: 'general',
            subcategory: '',
            inventory: 0,
            status: 'draft',
        });

        expect(validateProductId(' product-1 ')).toBe('product-1');
        expect(validateSellerId('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
        expect(() => validateCreateProductPayload({ name: 'Bike', inventory: -1, image: 'bike.png' })).toThrow(AppError);
        expect(() => validateCreateProductPayload({ name: 'Bike', inventory: '1.5', image: 'bike.png' })).toThrow(AppError);
        expect(() => validateCreateProductPayload({ name: 'Bike', inventory: 1, image: 'bike.png', status: 'deleted' })).toThrow(AppError);
        expect(() => validateSellerId('not-an-object-id')).toThrow(AppError);
    });

    it('normalizes product filters and rejects unsupported filter modes', () => {
        expect(validateProductFilters({
            search: ' bike ',
            category: ' Sports ',
            subcategory: ' Bikes ',
            seller: ' seller-1 ',
            status: 'active',
            availability: 'in_stock',
            sort: 'name_asc',
        })).toEqual({
            q: 'bike',
            category: 'sports',
            subcategory: 'bikes',
            seller: 'seller-1',
            status: 'active',
            availability: 'in_stock',
            sort: 'name_asc',
        });

        expect(validateProductFilters({})).toMatchObject({ sort: 'created_desc' });
        expect(() => validateProductFilters({ status: 'deleted' })).toThrow(AppError);
        expect(() => validateProductFilters({ availability: 'reserved' })).toThrow(AppError);
        expect(() => validateProductFilters({ sort: 'price_desc' })).toThrow(AppError);
    });
});

describe('middleware and utility characterization', () => {
    it('preserves AppError public fields', () => {
        const error = new AppError(422, 'VALIDATION_ERROR', 'Invalid payload', { field: 'email' });

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AppError');
        expect(error.statusCode).toBe(422);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.message).toBe('Invalid payload');
        expect(error.details).toEqual({ field: 'email' });
    });

    it('resolves default and header-selected tenants', () => {
        const next = vi.fn();
        const defaultReq = { headers: {} };
        const campusReq = { headers: { 'x-tenant-id': 'campus-market' } };

        tenantMiddleware(defaultReq, {}, next);
        tenantMiddleware(campusReq, {}, next);

        expect(defaultReq.tenant).toMatchObject({ id: 'mercadozetta', active: true });
        expect(campusReq.tenant).toMatchObject({ id: 'campus-market', active: true });
        expect(next).toHaveBeenCalledTimes(2);
    });

    it('rejects unknown tenants through next', () => {
        const next = vi.fn();

        tenantMiddleware({ headers: { 'x-tenant-id': 'missing-tenant' } }, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 400,
            code: 'INVALID_TENANT',
            message: 'Invalid tenant',
        }));
    });

    it('stores validated request data and forwards validator errors', () => {
        const req = {
            body: { name: 'Bike' },
            params: { productId: 'product-1' },
            query: { sort: 'name_asc' },
            validated: { tenantId: 'mercadozetta' },
        };
        const next = vi.fn();
        const schema = {
            body: vi.fn().mockReturnValue({ name: 'Bike' }),
            params: vi.fn().mockReturnValue({ productId: 'product-1' }),
            query: vi.fn().mockReturnValue({ sort: 'name_asc' }),
        };

        validateRequest(schema)(req, {}, next);

        expect(req.validated).toEqual({
            tenantId: 'mercadozetta',
            body: { name: 'Bike' },
            params: { productId: 'product-1' },
            query: { sort: 'name_asc' },
        });
        expect(next).toHaveBeenCalledWith();

        const validationError = new AppError(400, 'INVALID_PAYLOAD', 'Invalid payload');
        const failingNext = vi.fn();
        validateRequest({ body: vi.fn(() => { throw validationError; }) })({ body: {} }, {}, failingNext);

        expect(failingNext).toHaveBeenCalledWith(validationError);
    });

    it('formats AppError, malformed JSON, generic errors, and headers-sent errors', () => {
        const appErrorResponse = createResponse();
        const genericResponse = createResponse();
        const jsonResponse = createResponse();
        const delegatedResponse = createResponse();
        const next = vi.fn();
        delegatedResponse.headersSent = true;

        errorHandler(new AppError(422, 'VALIDATION_ERROR', 'Invalid payload', { field: 'email' }), {}, appErrorResponse, next);
        errorHandler(new Error('database offline'), {}, genericResponse, next);
        errorHandler({ type: 'entity.parse.failed' }, {}, jsonResponse, next);
        const delegatedError = new Error('stream failed');
        errorHandler(delegatedError, {}, delegatedResponse, next);

        expect(appErrorResponse.statusCode).toBe(422);
        expect(appErrorResponse.body).toEqual({
            error: 'Invalid payload',
            code: 'VALIDATION_ERROR',
            details: { field: 'email' },
        });
        expect(genericResponse.statusCode).toBe(500);
        expect(genericResponse.body).toEqual({
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
        });
        expect(jsonResponse.statusCode).toBe(400);
        expect(jsonResponse.body).toEqual({
            error: 'Invalid JSON payload',
            code: 'INVALID_JSON_PAYLOAD',
        });
        expect(next).toHaveBeenCalledWith(delegatedError);
    });

    it('forwards rejected async handlers to next', async () => {
        const error = new Error('boom');
        const next = vi.fn();
        const handler = asyncHandler(async () => {
            throw error;
        });

        await handler({}, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('generates and preserves request ids', () => {
        process.env.NODE_ENV = 'test';
        const generatedReq = { headers: {} };
        const preservedReq = { headers: { 'x-request-id': 'request-123' } };
        const generatedRes = createResponse();
        const preservedRes = createResponse();
        const next = vi.fn();

        requestContext(generatedReq, generatedRes, next);
        requestContext(preservedReq, preservedRes, next);

        expect(generatedReq.requestId).toEqual(expect.any(String));
        expect(generatedRes.headers['X-Request-Id']).toBe(generatedReq.requestId);
        expect(preservedReq.requestId).toBe('request-123');
        expect(preservedRes.headers['X-Request-Id']).toBe('request-123');
        expect(next).toHaveBeenCalledTimes(2);
    });

    it('reads security configuration from env with local fallbacks', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.JWT_SECRET;
        delete process.env.CORS_ORIGIN;
        delete process.env.RATE_LIMIT_AUTH_MAX;
        delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;

        expect(getJwtSecret()).toBe('mercadozetta-dev-secret');
        expect(getAllowedCorsOrigins()).toEqual(['http://localhost:5173']);
        expect(getRateLimitConfig('auth')).toEqual({
            windowMs: 15 * 60 * 1000,
            limit: 5,
            message: 'Too many login attempts, please try again later',
        });

        process.env.JWT_SECRET = 'configured-secret';
        process.env.CORS_ORIGIN = 'https://a.example.com, https://b.example.com';
        process.env.RATE_LIMIT_REGISTER_MAX = '3';
        process.env.RATE_LIMIT_REGISTER_WINDOW_MS = '60000';

        expect(getJwtSecret()).toBe('configured-secret');
        expect(getAllowedCorsOrigins()).toEqual(['https://a.example.com', 'https://b.example.com']);
        expect(getRateLimitConfig('register')).toMatchObject({ windowMs: 60000, limit: 3 });
    });

    it('rejects missing production JWT secrets and enforces CORS allow-lists', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        process.env.CORS_ORIGIN = 'https://market.example.com';
        const corsOptions = getCorsOptions();
        const callback = vi.fn();

        expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is required outside development and test');
        corsOptions.origin('https://market.example.com', callback);
        corsOptions.origin('https://unknown.example.com', callback);
        corsOptions.origin(undefined, callback);

        expect(callback).toHaveBeenNthCalledWith(1, null, true);
        expect(callback).toHaveBeenNthCalledWith(2, null, false);
        expect(callback).toHaveBeenNthCalledWith(3, null, true);
    });
});
