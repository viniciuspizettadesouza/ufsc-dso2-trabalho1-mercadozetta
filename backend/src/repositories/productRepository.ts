import type { ProductStatus } from '@/productStatus';
import type { Paginated } from '@/pagination';
import type { Money } from '@/money';

export type ProductRecord = {
  _id: string;
  tenantId: string;
  seller?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  inventory: number;
  price: Money | null;
  image?: string;
  status?: ProductStatus | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateProductRecord = Omit<
  ProductRecord,
  '_id' | 'createdAt' | 'updatedAt' | 'price'
> & {
  seller: string;
  category: string;
  subcategory: string;
  image: string;
  status: ProductStatus;
  price: Money;
};

export type ProductListQuery = {
  q?: string;
  category?: string;
  subcategory?: string;
  seller?: string;
  status?: string;
  availability?: string;
  sort?: string;
  limit: number;
  offset: number;
};

export type UpdateProductRecord = Partial<
  Pick<
    CreateProductRecord,
    | 'name'
    | 'description'
    | 'category'
    | 'subcategory'
    | 'image'
    | 'status'
    | 'inventory'
    | 'price'
  >
>;

export type AppendProductPriceHistory = {
  tenantId: string;
  productId: string;
  actorId: string;
  price: Money;
  changedAt: Date;
};

export interface ProductRepository {
  list(
    tenantId: string,
    query: ProductListQuery,
  ): Promise<Paginated<ProductRecord>>;
  create(product: CreateProductRecord): Promise<ProductRecord>;
  updateOwned(
    tenantId: string,
    productId: string,
    sellerId: string,
    update: UpdateProductRecord,
  ): Promise<ProductRecord | null>;
  findById(tenantId: string, productId: string): Promise<ProductRecord | null>;
  findByIdForUpdate(
    tenantId: string,
    productId: string,
  ): Promise<ProductRecord | null>;
  appendPriceHistory(entry: AppendProductPriceHistory): Promise<void>;
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
