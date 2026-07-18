import { describe, expect, it } from 'vitest';
import {
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
  validateUpdateProductPayload,
  productResponseSchema,
  productInvalidRequestExamples,
  validateProductInventoryUpdate,
  validateProductStatusUpdate,
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
    ).toBe('sold_out');

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
    expect(() =>
      validateCreateProductPayload({
        name: 'Keyboard',
        inventory: 1,
        image: 'keyboard.png',
        status: 'sold_out',
      }),
    ).toThrow(
      expect.objectContaining({ code: 'INVALID_PRODUCT_STATUS_INVENTORY' }),
    );

    expect(() =>
      validateCreateProductPayload({
        name: 'Keyboard',
        inventory: 1,
        image: 'javascript:alert(1)',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_IMAGE_URL' }));
    expect(() =>
      validateCreateProductPayload({
        name: 'Keyboard',
        inventory: 1,
        image: 'https://untrusted.example/keyboard.png',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_PRODUCT_IMAGE_URL' }));
  });

  it('strips immutable and inventory fields from descriptive updates', () => {
    expect(
      validateUpdateProductPayload({
        name: ' Updated ',
        seller: 'attacker',
        tenantId: 'other',
        inventory: 100,
        status: 'archived',
      }),
    ).toEqual({ name: 'Updated' });
    expect(() => validateUpdateProductPayload({ inventory: 2 })).toThrow(
      expect.objectContaining({ code: 'MISSING_PRODUCT_UPDATE_FIELDS' }),
    );
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
      limit: 20,
      offset: 0,
    });

    expect(validateProductFilters({ q: 'Direct', search: 'Ignored' })).toEqual({
      q: 'Direct',
      category: '',
      subcategory: '',
      seller: '',
      status: '',
      availability: '',
      sort: 'created_desc',
      limit: 20,
      offset: 0,
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
    expect(() => validateProductFilters({ limit: 101 })).toThrow();
    expect(() => validateProductFilters({ offset: -1 })).toThrow();
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

  it('defines the PostgreSQL product response including nullable fields and seller detail', () => {
    const product = {
      _id: '507f191e-810c-4197-9de8-60ea00000001',
      tenantId: 'mercadozetta',
      seller: '507f1f77-bcf8-4ecd-8994-390110000001',
      name: 'Keyboard',
      description: null,
      category: 'electronics',
      subcategory: 'keyboards',
      inventory: 2,
      image: 'keyboard.png',
      status: 'active',
      createdAt: '2026-01-15T12:00:00.000Z',
      updatedAt: '2026-01-15T12:00:00.000Z',
      sellerProfile: {
        _id: '507f1f77-bcf8-4ecd-8994-390110000001',
        username: null,
        telephone: null,
        email: 'seller@example.com',
        storeName: 'Seller store',
      },
    };

    expect(productResponseSchema.parse(product)).toEqual(product);
    expect(() =>
      productResponseSchema.parse({
        ...product,
        seller: product.sellerProfile,
      }),
    ).toThrow();
  });

  it('keeps documented INVALID_REQUEST examples aligned with Zod failures', () => {
    const cases = [
      [
        () => validateProductFilters({ limit: 101 }),
        productInvalidRequestExamples.list,
      ],
      [
        () => validateCreateProductPayload('invalid' as never),
        productInvalidRequestExamples.create,
      ],
      [
        () => validateUpdateProductPayload({ name: 1 } as never),
        productInvalidRequestExamples.update,
      ],
      [
        () => validateProductInventoryUpdate({ inventory: -1 }),
        productInvalidRequestExamples.inventory,
      ],
      [
        () => validateProductStatusUpdate({ status: 'deleted' }),
        productInvalidRequestExamples.status,
      ],
    ] as const;

    for (const [validate, example] of cases) {
      expect(validate).toThrow(
        expect.objectContaining({
          message: example.error,
          code: example.code,
        }),
      );
    }
  });
});
