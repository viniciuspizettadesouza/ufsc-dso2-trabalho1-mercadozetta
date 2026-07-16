export type PageInfo = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type Paginated<T> = { items: T[]; page: PageInfo };

export const firstPage: PageInfo = {
  limit: 20,
  offset: 0,
  total: 0,
  hasMore: false,
};

export function pageItems<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.items;
}

export function pageInfo<T>(data: Paginated<T> | T[]): PageInfo {
  return Array.isArray(data) ? { ...firstPage, total: data.length } : data.page;
}

export function withPage(path: string, offset: number, limit = 20) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}
