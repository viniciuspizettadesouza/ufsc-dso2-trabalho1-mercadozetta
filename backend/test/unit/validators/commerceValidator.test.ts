import { describe, expect, it } from 'vitest';
import {
  cartInvalidRequestExample,
  cartResponseSchema,
  reviewInvalidRequestExamples,
  reviewListResponseSchema,
  reviewResponseSchema,
  notificationInvalidRequestExamples,
  notificationListResponseSchema,
  notificationResponseSchema,
  orderInvalidRequestExamples,
  orderListResponseSchema,
  orderResponseSchema,
  unreadNotificationCountResponseSchema,
  watchlistEntryResponseSchema,
  watchlistResponseSchema,
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
    ).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: cartInvalidRequestExample.code,
        message: cartInvalidRequestExample.error,
      }),
    );
  });

  it('accepts the populated public cart response shape', () => {
    const timestamp = '2026-07-15T12:00:00.000Z';
    const cart = {
      tenantId: 'mercadozetta',
      buyer: resourceId,
      items: [
        {
          product: {
            _id: '507f191e-810c-4197-9de8-60ea00000002',
            tenantId: 'mercadozetta',
            seller: '507f191e-810c-4197-9de8-60ea00000003',
            name: 'keyboard',
            description: null,
            category: 'electronics',
            subcategory: 'keyboards',
            inventory: 2,
            price: { currency: 'USD', amountMinor: '1299' },
            image: 'keyboard.png',
            status: 'active',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          quantity: 1,
        },
      ],
    };

    expect(cartResponseSchema.parse(cart)).toEqual(cart);
    expect(() =>
      cartResponseSchema.parse({
        ...cart,
        items: [{ product: resourceId, quantity: 1 }],
      }),
    ).toThrow();
  });

  it('accepts one populated watchlist shape for lists and mutations', () => {
    const timestamp = '2026-07-15T12:00:00.000Z';
    const entry = {
      _id: '507f191e-810c-4197-9de8-60ea00000004',
      tenantId: 'mercadozetta',
      user: resourceId,
      product: {
        _id: '507f191e-810c-4197-9de8-60ea00000002',
        tenantId: 'mercadozetta',
        seller: '507f191e-810c-4197-9de8-60ea00000003',
        name: 'keyboard',
        description: null,
        category: 'electronics',
        subcategory: 'keyboards',
        inventory: 2,
        price: { currency: 'USD', amountMinor: '1299' },
        image: 'keyboard.png',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    expect(watchlistEntryResponseSchema.parse(entry)).toEqual(entry);
    expect(watchlistResponseSchema.parse([entry])).toEqual([entry]);
    expect(() =>
      watchlistEntryResponseSchema.parse({ ...entry, product: resourceId }),
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
    expect(() => validateOrderStatus({ status: 'refunded' })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: orderInvalidRequestExamples.status.code,
        message: orderInvalidRequestExamples.status.error,
      }),
    );
    expect(() => validateNotificationRead({ read: 'yes' })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: notificationInvalidRequestExamples.update.code,
        message: notificationInvalidRequestExamples.update.error,
      }),
    );
  });

  it('accepts complete notification, list, and unread-count responses', () => {
    const timestamp = '2026-07-15T12:00:00.000Z';
    const notification = {
      _id: '507f191e-810c-4197-9de8-60ea00000004',
      tenantId: 'mercadozetta',
      user: resourceId,
      message: 'Order created',
      read: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const list = {
      items: [notification],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    };

    expect(notificationResponseSchema.parse(notification)).toEqual(
      notification,
    );
    expect(notificationListResponseSchema.parse(list)).toEqual(list);
    expect(unreadNotificationCountResponseSchema.parse({ count: 1 })).toEqual({
      count: 1,
    });
  });

  it('keeps review validation errors synchronized with API examples', () => {
    expect(() => validateReview({ rating: 5, comment: '' })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: reviewInvalidRequestExamples.create.code,
        message: reviewInvalidRequestExamples.create.error,
      }),
    );
  });

  it('accepts complete persisted reviews in the shared page envelope', () => {
    const timestamp = '2026-07-15T12:00:00.000Z';
    const review = {
      _id: '507f191e-810c-4197-9de8-60ea00000004',
      tenantId: 'mercadozetta',
      product: '507f191e-810c-4197-9de8-60ea00000002',
      author: resourceId,
      rating: 5,
      comment: 'Excellent',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const list = {
      items: [review],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    };

    expect(reviewResponseSchema.parse(review)).toEqual(review);
    expect(reviewListResponseSchema.parse(list)).toEqual(list);
  });

  it('validates bounded buyer and seller order list scopes', () => {
    expect(
      validateOrderList({ scope: 'seller', limit: '10', offset: '20' }),
    ).toEqual({
      scope: 'seller',
      limit: 10,
      offset: 20,
      q: '',
    });
    expect(() => validateOrderList({ scope: 'admin' })).toThrow();
  });

  it('accepts complete orders with immutable items and status history', () => {
    const timestamp = '2026-07-15T12:00:00.000Z';
    const orderId = '507f191e-810c-4197-9de8-60ea00000004';
    const order = {
      _id: orderId,
      tenantId: 'mercadozetta',
      buyer: resourceId,
      status: 'placed',
      pricingState: 'priced',
      subtotal: { currency: 'USD', amountMinor: '1000' },
      discount: { currency: 'USD', amountMinor: '0' },
      shipping: { currency: 'USD', amountMinor: '0' },
      total: { currency: 'USD', amountMinor: '1000' },
      statusHistory: [
        { status: 'placed', actor: resourceId, changedAt: timestamp },
      ],
      items: [
        {
          tenantId: 'mercadozetta',
          order: orderId,
          product: '507f191e-810c-4197-9de8-60ea00000002',
          seller: '507f191e-810c-4197-9de8-60ea00000003',
          productName: 'keyboard',
          quantity: 1,
          pricingState: 'priced',
          unitPrice: { currency: 'USD', amountMinor: '1000' },
          lineSubtotal: { currency: 'USD', amountMinor: '1000' },
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const list = {
      items: [order],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    };

    expect(orderResponseSchema.parse(order)).toEqual(order);
    expect(orderListResponseSchema.parse(list)).toEqual(list);
  });
});
