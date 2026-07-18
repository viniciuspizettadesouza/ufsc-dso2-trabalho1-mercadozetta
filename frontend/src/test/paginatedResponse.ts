import type { PageInfo, Paginated } from '@/pagination';

export function paginatedResponse<T>(
  items: T[],
  page: Partial<PageInfo> = {},
): Paginated<T> {
  return {
    items,
    page: {
      limit: 20,
      offset: 0,
      total: items.length,
      hasMore: false,
      ...page,
    },
  };
}
