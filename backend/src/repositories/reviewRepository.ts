export type ReviewRecord = {
  _id: string;
  tenantId?: string;
  product: string;
  author: string;
  rating: number;
  comment: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface ReviewRepository {
  list(
    tenantId: string,
    productId: string,
    pagination: Pagination,
  ): Promise<Paginated<ReviewRecord>>;
  hasPurchasedProduct(
    tenantId: string,
    buyerId: string,
    productId: string,
  ): Promise<boolean>;
  upsert(
    tenantId: string,
    productId: string,
    authorId: string,
    rating: number,
    comment: string,
    now: Date,
  ): Promise<ReviewRecord>;
}
import type { Paginated, Pagination } from '@/pagination';
