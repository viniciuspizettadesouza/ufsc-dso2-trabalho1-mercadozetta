export type CheckoutOrderItem = {
  tenantId: string;
  order: string;
  product: string;
  seller: string;
  productName: string;
  quantity: number;
};

export interface OrderItemRepository {
  createMany(
    items: CheckoutOrderItem[],
    now: Date,
  ): Promise<CheckoutOrderItem[]>;
  listByOrderIds(
    tenantId: string,
    orderIds: string[],
  ): Promise<CheckoutOrderItem[]>;
  listOrderIdsBySeller(tenantId: string, sellerId: string): Promise<string[]>;
  sellerOwnsOrder(
    tenantId: string,
    orderId: string,
    sellerId: string,
  ): Promise<boolean>;
}
