const { validateLoginPayload } = require('../../../src/validators/authValidator');

describe('authValidator', () => {
    it('normalizes login email and keeps the password unchanged', () => {
        expect(validateLoginPayload({
            email: ' Seller@Example.com ',
            password: ' secret123 ',
        })).toEqual({
            email: 'seller@example.com',
            password: ' secret123 ',
        });
    });

    it('rejects payloads missing email or password', () => {
        expect(() => validateLoginPayload({ email: 'seller@example.com' }))
            .toThrow(expect.objectContaining({
                statusCode: 400,
                code: 'MISSING_CREDENTIALS',
            }));

        expect(() => validateLoginPayload({ password: 'secret123' }))
            .toThrow(expect.objectContaining({
                statusCode: 400,
                code: 'MISSING_CREDENTIALS',
            }));
    });
});
