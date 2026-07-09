const validateRequest = require('../../../src/middleware/validateRequest');

describe('validateRequest', () => {
    it('stores validated body, params, and query without dropping previous data', () => {
        const req = {
            body: { name: 'Keyboard' },
            params: { productId: 'product-1' },
            query: { sort: 'name_asc' },
            validated: { tenant: 'mercadozetta' },
        };
        const next = vi.fn();

        validateRequest({
            body: body => ({ ...body, normalized: true }),
            params: params => ({ id: params.productId }),
            query: query => ({ sort: query.sort }),
        })(req, {}, next);

        expect(req.validated).toEqual({
            tenant: 'mercadozetta',
            body: { name: 'Keyboard', normalized: true },
            params: { id: 'product-1' },
            query: { sort: 'name_asc' },
        });
        expect(next).toHaveBeenCalledWith();
    });

    it('forwards validation errors', () => {
        const error = new Error('invalid');
        const next = vi.fn();

        validateRequest({
            body: () => {
                throw error;
            },
        })({ body: {} }, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});

export {};
