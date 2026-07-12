export const orderStatuses = [
  'placed',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
