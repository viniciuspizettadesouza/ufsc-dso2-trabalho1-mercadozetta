export const orderStatuses = [
  'placed',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const sellerOrderTransitions: Partial<Record<OrderStatus, OrderStatus>> =
  {
    placed: 'confirmed',
    confirmed: 'shipped',
    shipped: 'delivered',
  };

export const buyerCancellableStatuses: OrderStatus[] = ['placed', 'confirmed'];
