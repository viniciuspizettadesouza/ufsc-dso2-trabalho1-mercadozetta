import { describe, expect, it, vi } from 'vitest';
import { createSellerOperationsService } from '@/services/sellerOperationsService';

describe('sellerOperationsService', () => {
  it('combines tenant-scoped summary, warnings, and inventory history', async () => {
    const repository = {
      getSummary: vi.fn().mockResolvedValue({ productCount: 1 }),
      listLowStock: vi.fn().mockResolvedValue([{ _id: 'product-1' }]),
      listInventoryHistory: vi.fn().mockResolvedValue({
        items: [{ _id: 'event-1' }],
        page: { limit: 10, offset: 20, total: 1, hasMore: false },
      }),
    };
    const service = createSellerOperationsService(repository as never);

    await expect(
      service.getSellerOperations('seller-1', 'campus-market', {
        lowStockThreshold: 3,
        limit: 10,
        offset: 20,
      }),
    ).resolves.toEqual({
      summary: { productCount: 1 },
      lowStockProducts: [{ _id: 'product-1' }],
      inventoryHistory: {
        items: [{ _id: 'event-1' }],
        page: { limit: 10, offset: 20, total: 1, hasMore: false },
      },
    });
    expect(repository.getSummary).toHaveBeenCalledWith(
      'campus-market',
      'seller-1',
      3,
    );
    expect(repository.listInventoryHistory).toHaveBeenCalledWith(
      'campus-market',
      'seller-1',
      { limit: 10, offset: 20 },
    );
  });
});
