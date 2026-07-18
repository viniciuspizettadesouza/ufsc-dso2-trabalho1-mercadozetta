import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Watchlist = components['schemas']['Watchlist'];
export type WatchlistEntry = components['schemas']['WatchlistEntry'];

export async function getWatchlist(): Promise<Watchlist> {
  const response = await api.get<Watchlist>(apiRoutes.watchlist);
  return response.data;
}

export async function putWatchlistItem(
  productId: string,
): Promise<WatchlistEntry> {
  const response = await api.put<WatchlistEntry>(
    apiRoutes.watchlistItem(productId),
  );
  return response.data;
}

export async function removeWatchlistItem(productId: string): Promise<void> {
  await api.delete<void>(apiRoutes.watchlistItem(productId));
}
