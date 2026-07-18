import type { components } from '@/contracts/api';

export type PageInfo = components['schemas']['PageInfo'];

export type Paginated<T> = { items: T[]; page: PageInfo };

export const firstPage: PageInfo = {
  limit: 20,
  offset: 0,
  total: 0,
  hasMore: false,
};

export function pageItems<T>(data: Paginated<T>): T[] {
  return data.items;
}

export function pageInfo<T>(data: Paginated<T>): PageInfo {
  return data.page;
}

export function withPage(path: string, offset: number, limit = 20) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}
