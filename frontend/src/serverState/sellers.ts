import { queryOptions, useQuery } from '@tanstack/react-query';

import { apiRoutes } from '@/routes';
import api from '@/services/api';
import { queryKeys } from '@/serverState/queryKeys';

export type Seller = {
  _id: string;
  username?: string;
  telephone?: string;
  email?: string;
  storeName?: string;
};

export const sellerQueries = {
  profile: (sellerId: string) =>
    queryOptions({
      queryKey: queryKeys.sellers.profile(sellerId),
      queryFn: async () => {
        const response = await api.get(apiRoutes.sellerProfile(sellerId));
        return response.data as Seller;
      },
    }),
};

export function useSellerProfile(sellerId: string, enabled: boolean) {
  return useQuery({
    ...sellerQueries.profile(sellerId),
    enabled,
  });
}
