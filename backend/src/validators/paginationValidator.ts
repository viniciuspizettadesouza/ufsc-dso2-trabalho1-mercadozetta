import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/pagination';
import type { RequestFieldValue } from '@/types/request';
import { parseAppSchema } from '@/validators/parseSchema';

export type PaginationQuery = {
  limit?: RequestFieldValue;
  offset?: RequestFieldValue;
};

export const paginationSchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_LIMIT)
      .default(DEFAULT_PAGE_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .meta({
    id: 'Pagination',
    description: `Offset pagination. Page size is limited to ${MAX_PAGE_LIMIT} items.`,
  });

export type PaginationData = z.infer<typeof paginationSchema>;

export const validatePagination = (query: PaginationQuery = {}) =>
  parseAppSchema(paginationSchema, query);
