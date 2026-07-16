import { describe, expect, it } from 'vitest';
import {
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
} from '@/validators/productValidator';

describe('productValidator', () => {
  it('normalizes product creation payloads and supports the quant alias', () => {
    expect(
      validateCreateProductPayload({
        name: ' Keyboard ',
        description: ' Mechanical ',
        category: ' Peripherals ',
        subcategory: ' Keyboards ',
        quant: '3',
        image: ' https://example.com/keyboard.png ',
      }),
    ).toEqual({
      name: 'Keyboard',
      description: 'Mechanical',
      category: 'peripherals',
      subcategory: 'keyboards',
      inventory: 3,
      image: 'https://example.com/keyboard.png',
      status: 'active',
    });

    expect(
      validateCreateProductPayload({
        name: 'Draft product',
        inventory: 0,
        image: 'draft.png',
        status: '',
      }).status,
    ).toBe('active');

    expect(
      validateCreateProductPayload({
        name: 'Inventory wins',
        inventory: 2,
        quant: 9,
        image: 'inventory.png',
        status: null,
      }).inventory,
    ).toBe(2);
  });

  it('rejects missing product fields, invalid inventory, and invalid statuses', () => {
    expect(() => validateCreateProductPayload()).toThrow(
      expect.objectContaining({ code: 'MISSING_PRODUCT_FIELDS' }),
    );

    expect(() =>
      validateCreateProductPayload({ name: 'Keyboard', inventory: 1 }),
    ).toThrow(expect.objectContaining({ code: 'MISSING_PRODUCT_FIELDS' }));

    expect(() =>
      validateCreateProductPayload({
        name: 'Keyboard',
        inventory: '',
        image: 'keyboard.png',
      }),
    ).toThrow(expect.objectContaining({ code: 'MISSING_PRODUCT_FIELDS' }));

    expect(() =>
      validateCreateProductPayload({
        inventory: 1,
        image: 'keyboard.png',
      }),
    ).toThrow(expect.objectContaining({ code: 'MISSING_PRODUCT_FIELDS' }));

    expect(() =>
      validateCreateProductPayload({
        name: 'Keyboard',
        inventory: '1.5',
        image: 'keyboard.png',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_INVENTORY' }));

    expect(() =>
      validateCreateProductPayload({
        name: 'Keyboard',
        inventory: 1,
        image: 'keyboard.png',
        status: 'deleted',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_STATUS' }));
  });

  it('normalizes and validates product filters', () => {
    expect(
      validateProductFilters({
        search: ' Keyboard ',
        category: ' Peripherals ',
        subcategory: ' Keyboards ',
        seller: 'user-1',
        status: 'active',
        availability: 'in_stock',
        sort: 'name_asc',
      }),
    ).toEqual({
      q: 'Keyboard',
      category: 'peripherals',
      subcategory: 'keyboards',
      seller: 'user-1',
      status: 'active',
      availability: 'in_stock',
      sort: 'name_asc',
    });

    expect(validateProductFilters({ q: 'Direct', search: 'Ignored' })).toEqual({
      q: 'Direct',
      category: '',
      subcategory: '',
      seller: '',
      status: '',
      availability: '',
      sort: 'created_desc',
    });
  });

  it('rejects invalid product filters', () => {
    expect(() => validateProductFilters({ status: 'deleted' })).toThrow(
      expect.objectContaining({ code: 'INVALID_PRODUCT_STATUS_FILTER' }),
    );

    expect(() =>
      validateProductFilters({ availability: 'backordered' }),
    ).toThrow(
      expect.objectContaining({ code: 'INVALID_PRODUCT_AVAILABILITY_FILTER' }),
    );

    expect(() => validateProductFilters({ sort: 'price_desc' })).toThrow(
      expect.objectContaining({ code: 'INVALID_PRODUCT_SORT' }),
    );
  });

  it('validates product and seller identifiers', () => {
    expect(validateProductId(' 507F191E-810C-4197-9DE8-60EA00000001 ')).toBe(
      '507f191e-810c-4197-9de8-60ea00000001',
    );
    expect(() => validateProductId('')).toThrow(
      expect.objectContaining({ code: 'INVALID_PRODUCT_ID' }),
    );
    expect(() => validateProductId(null)).toThrow(
      expect.objectContaining({ code: 'INVALID_PRODUCT_ID' }),
    );

    expect(validateSellerId('507F1F77-BCF8-4ECD-8994-390110000001')).toBe(
      '507f1f77-bcf8-4ecd-8994-390110000001',
    );
    expect(() => validateSellerId('not-a-uuid')).toThrow(
      expect.objectContaining({ code: 'INVALID_SELLER_ID' }),
    );
  });
});
