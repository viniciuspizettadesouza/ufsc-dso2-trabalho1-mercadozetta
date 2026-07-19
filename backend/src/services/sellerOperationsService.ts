import type { SellerOperationsRepository } from '@/repositories/sellerOperationsRepository';
import type { SellerOperationsQuery } from '@/validators/commerceValidator';

export function createSellerOperationsService(
  repository: SellerOperationsRepository,
) {
  return {
    async getSellerOperations(
      sellerId: string,
      tenantId: string,
      query: SellerOperationsQuery,
    ) {
      const { lowStockThreshold, limit, offset } = query;
      const [summary, lowStockProducts, inventoryHistory] = await Promise.all([
        repository.getSummary(tenantId, sellerId, lowStockThreshold),
        repository.listLowStock(tenantId, sellerId, lowStockThreshold),
        repository.listInventoryHistory(tenantId, sellerId, { limit, offset }),
      ]);
      return { summary, lowStockProducts, inventoryHistory };
    },
  };
}

export type SellerOperationsService = ReturnType<
  typeof createSellerOperationsService
>;
