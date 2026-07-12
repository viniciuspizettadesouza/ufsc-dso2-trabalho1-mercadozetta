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
        image: 'bike.png',
      }),
    ).toEqual({
      name: 'Bicycle',
      description: 'Fast bike',
      category: 'general',
      subcategory: '',
      inventory: 2,
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
    expect(validateProductId('product-1')).toBe('product-1');
    expect(validateSellerId('507f1f77bcf86cd799439011')).toBe(
      '507f1f77bcf86cd799439011',
    );
    expect(() => validateSellerId('not-an-object-id')).toThrow(AppError);
  });
});
