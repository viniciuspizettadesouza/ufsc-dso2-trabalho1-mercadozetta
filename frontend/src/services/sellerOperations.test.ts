import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/api';
import { getSellerOperations } from '@/services/sellerOperations';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));

describe('seller operations service', () => {
  beforeEach(() => vi.mocked(api.get).mockReset());

  it('loads thresholded and paginated seller operations', async () => {
    const data = { summary: {}, lowStockProducts: [], inventoryHistory: {} };
    vi.mocked(api.get).mockResolvedValue({ data });

    await expect(
      getSellerOperations({
        userId: 'seller-1',
        lowStockThreshold: 3,
        limit: 10,
        offset: 20,
      }),
    ).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledWith(
      '/seller/operations?lowStockThreshold=3&limit=10&offset=20',
    );
  });
});
