export const productStatuses = [
  'draft',
  'active',
  'paused',
  'sold_out',
  'archived',
] as const;
export type ProductStatus = (typeof productStatuses)[number];
