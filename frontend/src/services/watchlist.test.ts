import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  getWatchlist,
  putWatchlistItem,
  removeWatchlistItem,
  type Watchlist,
  type WatchlistEntry,
} from '@/services/watchlist';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const entry = {
  _id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'mercadozetta',
  user: '22222222-2222-4222-8222-222222222222',
  product: { _id: 'product-1' } as WatchlistEntry['product'],
  createdAt: '2026-07-18T10:00:00.000Z',
  updatedAt: '2026-07-18T10:00:00.000Z',
} satisfies WatchlistEntry;
const watchlist: Watchlist = [entry];

describe('watchlist service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('loads the watchlist through the shared route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: watchlist });

    await expect(getWatchlist()).resolves.toBe(watchlist);

    expect(api.get).toHaveBeenCalledWith('/watchlist');
  });

  it('puts a watchlist item and returns the server entry', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: entry });

    await expect(putWatchlistItem('product-1')).resolves.toBe(entry);

    expect(api.put).toHaveBeenCalledWith('/watchlist/product-1');
  });

  it('removes a watchlist item through its product route', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });

    await expect(removeWatchlistItem('product-1')).resolves.toBeUndefined();

    expect(api.delete).toHaveBeenCalledWith('/watchlist/product-1');
  });
});
