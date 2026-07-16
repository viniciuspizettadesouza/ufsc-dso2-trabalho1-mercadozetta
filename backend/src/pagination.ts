export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export type Pagination = {
  limit: number;
  offset: number;
};

export type PageInfo = Pagination & {
  total: number;
  hasMore: boolean;
};

export type Paginated<T> = {
  items: T[];
  page: PageInfo;
};

export function paginated<T>(items: T[], total: number, page: Pagination) {
  return {
    items,
    page: {
      limit: page.limit,
      offset: page.offset,
      total,
      hasMore: page.offset + items.length < total,
    },
  };
}
