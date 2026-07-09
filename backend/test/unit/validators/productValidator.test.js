const {
    validateCreateProductPayload,
    validateProductFilters,
    validateProductId,
    validateSellerId,
} = require('../../../src/validators/productValidator');

describe('productValidator', () => {
    it('normalizes product creation payloads and supports the quant alias', () => {
        expect(validateCreateProductPayload({
            name: ' Keyboard ',
            description: ' Mechanical ',
            category: ' Peripherals ',
            subcategory: ' Keyboards ',
            quant: '3',
            image: ' https://example.com/keyboard.png ',
        })).toEqual({
            name: 'Keyboard',
            description: 'Mechanical',
            category: 'peripherals',
            subcategory: 'keyboards',
            inventory: 3,
            image: 'https://example.com/keyboard.png',
            status: 'active',
        });
    });

    it('rejects missing product fields, invalid inventory, and invalid statuses', () => {
        expect(() => validateCreateProductPayload({ name: 'Keyboard', inventory: 1 }))
            .toThrow(expect.objectContaining({ code: 'MISSING_PRODUCT_FIELDS' }));

        expect(() => validateCreateProductPayload({
            name: 'Keyboard',
            inventory: '1.5',
            image: 'keyboard.png',
        })).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_INVENTORY' }));

        expect(() => validateCreateProductPayload({
            name: 'Keyboard',
            inventory: 1,
            image: 'keyboard.png',
            status: 'deleted',
        })).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_STATUS' }));
    });

    it('normalizes and validates product filters', () => {
        expect(validateProductFilters({
            search: ' Keyboard ',
            category: ' Peripherals ',
            subcategory: ' Keyboards ',
            seller: 'user-1',
            status: 'active',
            availability: 'in_stock',
            sort: 'name_asc',
        })).toEqual({
            q: 'Keyboard',
            category: 'peripherals',
            subcategory: 'keyboards',
            seller: 'user-1',
            status: 'active',
            availability: 'in_stock',
            sort: 'name_asc',
        });
    });

    it('rejects invalid product filters', () => {
        expect(() => validateProductFilters({ status: 'deleted' }))
            .toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_STATUS_FILTER' }));

        expect(() => validateProductFilters({ availability: 'backordered' }))
            .toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_AVAILABILITY_FILTER' }));

        expect(() => validateProductFilters({ sort: 'price_desc' }))
            .toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_SORT' }));
    });

    it('validates product and seller identifiers', () => {
        expect(validateProductId(' product-1 ')).toBe('product-1');
        expect(() => validateProductId('')).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_ID' }));

        expect(validateSellerId('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
        expect(() => validateSellerId('not-an-object-id'))
            .toThrow(expect.objectContaining({ code: 'INVALID_SELLER_ID' }));
    });
});
