import { describe, expect, it } from 'vitest';

import AppError from '@/errors/AppError';
import {
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
} from '@/validators/productValidator';

describe('product validator', () => {
  it('validates create-product payloads and filters with the same rules as the controllers', () => {
    expect(
      validateCreateProductPayload({
        name: ' Bicycle ',
        description: 'Fast bike',
        inventory: 2,
        price: { currency: 'USD', amountMinor: '2500' },
        image: 'bike.png',
      }),
    ).toEqual({
      name: 'Bicycle',
      description: 'Fast bike',
      category: 'general',
      subcategory: '',
      inventory: 2,
      price: { currency: 'USD', amountMinor: '2500' },
      image: 'bike.png',
      status: 'active',
    });

    expect(() =>
      validateCreateProductPayload({
        name: 'x',
        inventory: -1,
        image: 'img.png',
      }),
    ).toThrow(AppError);
    expect(() => validateProductFilters({ status: 'invalid' })).toThrow(
      AppError,
    );
    expect(validateProductId(' 507F191E-810C-4197-9DE8-60EA00000001 ')).toBe(
      '507f191e-810c-4197-9de8-60ea00000001',
    );
    expect(validateSellerId('507f1f77-bcf8-4ecd-8994-390110000001')).toBe(
      '507f1f77-bcf8-4ecd-8994-390110000001',
    );
    expect(() => validateSellerId('not-a-uuid')).toThrow(AppError);
  });
});
