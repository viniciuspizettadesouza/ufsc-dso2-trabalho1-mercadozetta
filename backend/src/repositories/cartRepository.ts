export type CheckoutCartItem = {
  productId: string;
  quantity: number;
};

export type CheckoutCart = {
  id: string;
  tenantId: string;
  buyerId: string;
  items: CheckoutCartItem[];
};

export interface CartRepository {
  get(
    tenantId: string,
    buyerId: string,
  ): Promise<{
    tenantId: string;
    buyer: string;
    items: Array<{ product: ProductRecord; quantity: number }>;
  } | null>;
  setItem(
    tenantId: string,
    buyerId: string,
    productId: string,
    quantity: number,
  ): Promise<void>;
  removeItem(
    tenantId: string,
    buyerId: string,
    productId: string,
  ): Promise<void>;
  findForCheckout(
    tenantId: string,
    buyerId: string,
  ): Promise<CheckoutCart | null>;
  clear(tenantId: string, cartId: string): Promise<void>;
}
import type { ProductRecord } from '@/repositories/productRepository';
