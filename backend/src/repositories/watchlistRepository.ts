import type { ProductRecord } from '@/repositories/productRepository';

export type WatchlistRecord = {
  _id: string;
  tenantId: string;
  user: string;
  product: ProductRecord | string;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface WatchlistRepository {
  list(tenantId: string, userId: string): Promise<WatchlistRecord[]>;
  add(
    tenantId: string,
    userId: string,
    productId: string,
    now: Date,
  ): Promise<WatchlistRecord>;
  remove(tenantId: string, userId: string, productId: string): Promise<void>;
}
