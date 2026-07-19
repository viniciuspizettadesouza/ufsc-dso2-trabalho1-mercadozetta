import type { components } from '@/contracts/api';
import { withPage } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type SellerOperations = components['schemas']['SellerOperations'];
export type SellerOperationsRequest = {
  userId: string;
  lowStockThreshold: number;
  limit: number | null;
  offset: number | null;
};

export async function getSellerOperations(
  request: SellerOperationsRequest,
): Promise<SellerOperations> {
  const base = `${apiRoutes.sellerOperations}?lowStockThreshold=${request.lowStockThreshold}`;
  const path =
    request.limit === null || request.offset === null
      ? base
      : withPage(base, request.offset, request.limit);
  const response = await api.get<SellerOperations>(path);
  return response.data;
}
