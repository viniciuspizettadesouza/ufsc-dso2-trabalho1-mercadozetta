const Product = require('../src/model/product');
const User = require('../src/model/user');

describe('model indexes', () => {
    it('keeps user emails unique', () => {
        expect(User.schema.path('email').options.unique).toBe(true);
    });

    it('indexes products by seller', () => {
        expect(Product.schema.indexes()).toContainEqual([
            { seller: 1 },
            expect.any(Object),
        ]);
    });
});
