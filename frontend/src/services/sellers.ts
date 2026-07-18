import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Seller = components['schemas']['SellerProfile'];

export async function getSeller(sellerId: string): Promise<Seller> {
  const response = await api.get<Seller>(apiRoutes.sellerProfile(sellerId));
  return response.data;
}
