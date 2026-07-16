import { describe, expect, it } from 'vitest';
import { pageInfo, pageItems, withPage } from '@/pagination';

describe('pagination helpers', () => {
  it('reads paginated responses and legacy arrays safely', () => {
    const response = {
      items: ['item'],
      page: { limit: 1, offset: 0, total: 2, hasMore: true },
    };
    expect(pageItems(response)).toEqual(['item']);
    expect(pageInfo(response)).toEqual(response.page);
    expect(pageItems(['legacy'])).toEqual(['legacy']);
    expect(pageInfo(['legacy'])).toMatchObject({ total: 1, hasMore: false });
  });

  it('adds pages to plain and filtered paths', () => {
    expect(withPage('/orders', 20)).toBe('/orders?limit=20&offset=20');
    expect(withPage('/orders?scope=seller', 10, 10)).toBe(
      '/orders?scope=seller&limit=10&offset=10',
    );
  });
});
