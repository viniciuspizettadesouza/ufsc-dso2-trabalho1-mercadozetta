import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getSellerOperations,
  type SellerOperationsRequest,
} from '@/services/sellerOperations';

export function useSellerOperations(
  request: SellerOperationsRequest,
  enabled = true,
) {
  return useQuery({
    queryKey: ['seller-operations', request],
    queryFn: () => getSellerOperations(request),
    enabled,
    placeholderData: keepPreviousData,
  });
}
