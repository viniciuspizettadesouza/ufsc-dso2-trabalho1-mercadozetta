import { describe, expect, it } from 'vitest';
import {
  validateCartItem,
  validateNotificationRead,
  validateOrderStatus,
  validateResourceId,
  validateReview,
  validateOrderList,
} from '@/validators/commerceValidator';

const resourceId = '507f191e-810c-4197-9de8-60ea00000001';

describe('commerce validator', () => {
  it('normalizes canonical UUID resource identifiers and rejects legacy shapes', () => {
    expect(validateResourceId(' 507F191E-810C-4197-9DE8-60EA00000001 ')).toBe(
      resourceId,
    );
    expect(() => validateResourceId('507f1f77bcf86cd799439011')).toThrow(
      expect.objectContaining({ code: 'INVALID_RESOURCE_ID' }),
    );
    expect(() => validateResourceId('not-a-uuid')).toThrow(
      expect.objectContaining({ code: 'INVALID_RESOURCE_ID' }),
    );
  });

  it('validates cart item identifiers and positive integer quantities', () => {
    expect(validateCartItem({ productId: resourceId })).toEqual({
      productId: resourceId,
      quantity: 1,
    });
    expect(
      validateCartItem({
        productId: resourceId.toUpperCase(),
        quantity: '2',
      }),
    ).toEqual({ productId: resourceId, quantity: 2 });
    expect(() =>
      validateCartItem({ productId: resourceId, quantity: 0 }),
    ).toThrow();
  });

  it('validates reviews, order statuses, and notification read state', () => {
    expect(validateReview({ rating: '5', comment: ' Great product ' })).toEqual(
      {
        rating: 5,
        comment: 'Great product',
      },
    );
    expect(validateOrderStatus({ status: 'confirmed' })).toEqual({
      status: 'confirmed',
    });
    expect(validateNotificationRead({ read: true })).toEqual({ read: true });

    expect(() => validateReview({ rating: 6, comment: 'Invalid' })).toThrow();
    expect(() => validateOrderStatus({ status: 'refunded' })).toThrow();
    expect(() => validateNotificationRead({ read: 'yes' })).toThrow();
  });

  it('validates bounded buyer and seller order list scopes', () => {
    expect(
      validateOrderList({ scope: 'seller', limit: '10', offset: '20' }),
    ).toEqual({
      scope: 'seller',
      limit: 10,
      offset: 20,
    });
    expect(() => validateOrderList({ scope: 'admin' })).toThrow();
  });
});
