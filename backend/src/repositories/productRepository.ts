import type { ProductStatus } from '@/productStatus';

export type ProductRecord = {
  _id: string;
  tenantId: string;
  seller?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  inventory: number;
  image?: string;
  status?: ProductStatus | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateProductRecord = Omit<
  ProductRecord,
  '_id' | 'createdAt' | 'updatedAt'
> & {
  seller: string;
  category: string;
  subcategory: string;
  image: string;
  status: ProductStatus;
};

export interface ProductRepository {
  list(tenantId: string, sellerId?: string): Promise<ProductRecord[]>;
  create(product: CreateProductRecord): Promise<ProductRecord>;
  findById(tenantId: string, productId: string): Promise<ProductRecord | null>;
  findActiveById(
    tenantId: string,
    productId: string,
  ): Promise<ProductRecord | null>;
  findByIds(tenantId: string, productIds: string[]): Promise<ProductRecord[]>;
  findByIdsForUpdate(
    tenantId: string,
    productIds: string[],
  ): Promise<ProductRecord[]>;
  decrementAvailableInventory(
    tenantId: string,
    productId: string,
    quantity: number,
  ): Promise<boolean>;
}
