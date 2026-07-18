import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Cart = components['schemas']['Cart'];
export type CartItem = components['schemas']['CartItem'];
export type CartItemInput = Required<components['schemas']['CartItemRequest']>;

export async function getCart(): Promise<Cart> {
  const response = await api.get<Cart>(apiRoutes.cart);
  return response.data;
}

export async function putCartItem(input: CartItemInput): Promise<Cart> {
  const response = await api.put<Cart>(apiRoutes.cartItems, input);
  return response.data;
}

export async function removeCartItem(productId: string): Promise<Cart> {
  const response = await api.delete<Cart>(apiRoutes.cartItem(productId));
  return response.data;
}
