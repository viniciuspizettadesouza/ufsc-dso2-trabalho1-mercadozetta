import { queryOptions, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/serverState/queryKeys';
import { getSeller } from '@/services/sellers';

export type { Seller } from '@/services/sellers';

export const sellerQueries = {
  profile: (sellerId: string) =>
    queryOptions({
      queryKey: queryKeys.sellers.profile(sellerId),
      queryFn: () => getSeller(sellerId),
    }),
};

export function useSellerProfile(sellerId: string, enabled: boolean) {
  return useQuery({
    ...sellerQueries.profile(sellerId),
    enabled,
  });
}
