import { describe, expect, it } from 'vitest';
import { validatePagination } from '@/validators/paginationValidator';
import { paginated } from '@/pagination';

describe('paginationValidator', () => {
  it('applies bounded defaults and coerces query strings', () => {
    expect(validatePagination()).toEqual({ limit: 20, offset: 0 });
    expect(validatePagination({ limit: '100', offset: '40' })).toEqual({
      limit: 100,
      offset: 40,
    });
  });

  it('rejects unbounded, fractional, and negative pages', () => {
    expect(() => validatePagination({ limit: 101 })).toThrow();
    expect(() => validatePagination({ limit: 1.5 })).toThrow();
    expect(() => validatePagination({ offset: -1 })).toThrow();
  });

  it('builds consistent page metadata', () => {
    expect(paginated(['a', 'b'], 3, { limit: 2, offset: 0 })).toEqual({
      items: ['a', 'b'],
      page: { limit: 2, offset: 0, total: 3, hasMore: true },
    });
  });
});
