import type { OrderStatus } from '@/orderStatus';
import type { Paginated } from '@/pagination';
import type { OrderListData } from '@/validators/commerceValidator';

export type CheckoutOrder = {
  _id: string;
  tenantId: string;
  buyer: string;
  status: OrderStatus;
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
    now: Date,
  ): Promise<CheckoutOrder>;
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
