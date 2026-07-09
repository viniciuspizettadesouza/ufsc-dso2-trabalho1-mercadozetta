const tenantMiddleware = require('../../../src/middleware/tenant');

describe('tenantMiddleware', () => {
    it('uses the default tenant when no tenant header is provided', () => {
        const req = { headers: {} };
        const next = vi.fn();

        tenantMiddleware(req, {}, next);

        expect(req.tenant).toEqual(expect.objectContaining({
            id: 'mercadozetta',
            name: 'MercadoZetta',
        }));
        expect(next).toHaveBeenCalledWith();
    });

    it('resolves valid tenant headers', () => {
        const req = { headers: { 'x-tenant-id': 'campus-market' } };
        const next = vi.fn();

        tenantMiddleware(req, {}, next);

        expect(req.tenant).toEqual(expect.objectContaining({
            id: 'campus-market',
            name: 'CampusMarket',
        }));
        expect(next).toHaveBeenCalledWith();
    });

    it('rejects invalid tenant headers', () => {
        const req = { headers: { 'x-tenant-id': 'unknown' } };
        const next = vi.fn();

        tenantMiddleware(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 400,
            code: 'INVALID_TENANT',
        }));
    });
});
