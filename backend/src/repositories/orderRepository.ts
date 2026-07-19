import type { OrderStatus } from '@/orderStatus';
import type { Paginated } from '@/pagination';
import type { OrderListData } from '@/validators/commerceValidator';
import type { Money } from '@/money';

export type OrderPricingState = 'legacy_unpriced' | 'priced';

export type CreateOrderPricing = {
  currency: string;
  currencyMinorUnit: number;
  subtotalMinor: bigint;
  discountMinor: bigint;
  shippingMinor: bigint;
  totalMinor: bigint;
};

export type CheckoutOrder = {
  _id: string;
  tenantId: string;
  buyer: string;
  status: OrderStatus;
  pricingState: OrderPricingState;
  subtotal: Money | null;
  discount: Money | null;
  shipping: Money | null;
  total: Money | null;
  statusHistory: Array<{
    status: OrderStatus;
    actor: string;
    changedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export interface OrderRepository {
  createPlaced(
    tenantId: string,
    buyerId: string,
    idempotencyKey: string,
    pricing: CreateOrderPricing,
    now: Date,
  ): Promise<CheckoutOrder>;
  findByCheckoutIdempotencyKey(
    tenantId: string,
    buyerId: string,
    idempotencyKey: string,
  ): Promise<CheckoutOrder | null>;
  findById(tenantId: string, orderId: string): Promise<CheckoutOrder | null>;
  listByIds(tenantId: string, orderIds: string[]): Promise<CheckoutOrder[]>;
  listIdsByBuyer(tenantId: string, buyerId: string): Promise<string[]>;
  listVisible(
    tenantId: string,
    userId: string,
    pagination: OrderListData,
  ): Promise<Paginated<CheckoutOrder>>;
  updateStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    actorId: string,
    now: Date,
  ): Promise<CheckoutOrder>;
}
