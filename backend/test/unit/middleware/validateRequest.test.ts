import { describe, expect, it, vi } from 'vitest';
import validateRequest from '@/middleware/validateRequest';

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
      body: (body: { name?: string }) => ({
        name: String(body.name),
        description: '',
        category: 'peripherals',
        subcategory: 'keyboards',
        inventory: 1,
        image: 'keyboard.png',
        status: 'active',
      }),
      params: (params: { productId: string }) => ({
        productId: params.productId,
      }),
      query: (query: { sort?: string }) => ({
        q: '',
        category: '',
        subcategory: '',
        seller: '',
        status: '',
        availability: '',
        sort: String(query.sort),
      }),
    })(req as any, {} as any, next);

    expect(req.validated).toEqual({
      tenant: 'mercadozetta',
      body: {
        name: 'Keyboard',
        description: '',
        category: 'peripherals',
        subcategory: 'keyboards',
        inventory: 1,
        image: 'keyboard.png',
        status: 'active',
      },
      params: { productId: 'product-1' },
      query: {
        q: '',
        category: '',
        subcategory: '',
        seller: '',
        status: '',
        availability: '',
        sort: 'name_asc',
      },
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
    })({ body: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
