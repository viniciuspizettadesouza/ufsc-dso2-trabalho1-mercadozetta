import { describe, expect, it } from 'vitest';

import { queryKeys, type ProductListRequest } from '@/serverState/queryKeys';

describe('queryKeys', () => {
  it('keys product lists by scope, filters, sorting, and pagination', () => {
    const request: ProductListRequest = {
      sellerId: 'seller-1',
      q: 'coffee',
      category: 'drinks',
      availability: 'in_stock',
      sort: 'name_asc',
      limit: 20,
      offset: 40,
    };

    expect(queryKeys.products.list(request)).toEqual([
      'products',
      'list',
      request,
    ]);
  });

  it('separates user-scoped notification counts', () => {
    expect(queryKeys.notifications.unreadCount('user-1')).not.toEqual(
      queryKeys.notifications.unreadCount('user-2'),
    );
  });

  it('keys product details by product ID', () => {
    expect(queryKeys.products.detail('product-1')).toEqual([
      'products',
      'detail',
      'product-1',
    ]);
  });

  it('keys seller profiles by seller ID', () => {
    expect(queryKeys.sellers.profile('seller-1')).toEqual([
      'sellers',
      'profile',
      'seller-1',
    ]);
  });

  it('separates authenticated collection state by user', () => {
    expect(queryKeys.cart.items('user-1')).not.toEqual(
      queryKeys.cart.items('user-2'),
    );
    expect(queryKeys.cart.productIds('user-1')).not.toEqual(
      queryKeys.cart.productIds('user-2'),
    );
    expect(queryKeys.watchlist.productIds('user-1')).not.toEqual(
      queryKeys.watchlist.productIds('user-2'),
    );
  });

  it('keys review lists by product and pagination', () => {
    expect(
      queryKeys.reviews.list({
        productId: 'product-1',
        limit: 20,
        offset: 40,
      }),
    ).toEqual(['reviews', 'list', 'product-1', { limit: 20, offset: 40 }]);
  });

  it('keys order lists by user, scope, and pagination', () => {
    expect(
      queryKeys.orders.list({
        userId: 'seller-1',
        scope: 'seller',
        limit: 20,
        offset: 40,
      }),
    ).toEqual([
      'orders',
      'list',
      {
        userId: 'seller-1',
        scope: 'seller',
        limit: 20,
        offset: 40,
      },
    ]);
  });

  it('keys notification lists by user and pagination', () => {
    expect(
      queryKeys.notifications.list({
        userId: 'user-1',
        limit: 20,
        offset: 40,
      }),
    ).toEqual(['notifications', 'list', 'user-1', { limit: 20, offset: 40 }]);
  });
});
