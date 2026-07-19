import type { Paginated, Pagination } from '@/pagination';
import type { Money } from '@/money';

export type InventoryHistoryEntry = {
  _id: string;
  eventType: 'inventory.set' | 'inventory.decremented';
  product: string;
  productName: string;
  previousInventory: number;
  nextInventory: number;
  quantity: number | null;
  orderId: string | null;
  occurredAt: Date;
};

export type LowStockProduct = {
  _id: string;
  name: string;
  inventory: number;
  status: string;
};

export type SellerOperationsSummary = {
  productCount: number;
  activeProductCount: number;
  lowStockProductCount: number;
  inventoryUnits: number;
  orderCount: number;
  openOrderCount: number;
  orderedUnits: number;
  pricedOrderCount: number;
  legacyUnpricedOrderCount: number;
  grossRevenue: Money;
};

export interface SellerOperationsRepository {
  getSummary(
    tenantId: string,
    sellerId: string,
    lowStockThreshold: number,
  ): Promise<SellerOperationsSummary>;
  listLowStock(
    tenantId: string,
    sellerId: string,
    threshold: number,
  ): Promise<LowStockProduct[]>;
  listInventoryHistory(
    tenantId: string,
    sellerId: string,
    pagination: Pagination,
  ): Promise<Paginated<InventoryHistoryEntry>>;
}
