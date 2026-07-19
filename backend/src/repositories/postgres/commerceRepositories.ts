import { randomUUID } from 'node:crypto';
import { and, count, desc, eq } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import {
  orderItems,
  orders,
  products,
  reviews,
  watchlistEntries,
} from '@/database/schema';
import { mapProductRow } from '@/repositories/mappers';
import type { ReviewRepository } from '@/repositories/reviewRepository';
import type { WatchlistRepository } from '@/repositories/watchlistRepository';
import { paginated } from '@/pagination';
import type { Pagination } from '@/pagination';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export class PostgresWatchlistRepository implements WatchlistRepository {
  constructor(private readonly db: Database) {}

  async list(tenantId: string, userId: string) {
    const rows = await this.db
      .select({ entry: watchlistEntries, product: products })
      .from(watchlistEntries)
      .innerJoin(
        products,
        and(
          eq(products.tenantId, watchlistEntries.tenantId),
          eq(products.id, watchlistEntries.productId),
        ),
      )
      .where(
        and(
          eq(watchlistEntries.tenantId, tenantId),
          eq(watchlistEntries.userId, userId),
        ),
      )
      .orderBy(desc(watchlistEntries.createdAt), desc(watchlistEntries.id));
    return rows.map(({ entry, product }) => ({
      _id: entry.id,
      tenantId: entry.tenantId,
      user: entry.userId,
      product: mapProductRow(product),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  }

  async add(tenantId: string, userId: string, productId: string, now: Date) {
    await this.db
      .insert(watchlistEntries)
      .values({
        id: randomUUID(),
        tenantId,
        userId,
        productId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [
          watchlistEntries.tenantId,
          watchlistEntries.userId,
          watchlistEntries.productId,
        ],
      });
    const [entry] = await this.db
      .select()
      .from(watchlistEntries)
      .where(
        and(
          eq(watchlistEntries.tenantId, tenantId),
          eq(watchlistEntries.userId, userId),
          eq(watchlistEntries.productId, productId),
        ),
      )
      .limit(1);
    return {
      _id: entry.id,
      tenantId: entry.tenantId,
      user: entry.userId,
      product: entry.productId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async remove(tenantId: string, userId: string, productId: string) {
    await this.db
      .delete(watchlistEntries)
      .where(
        and(
          eq(watchlistEntries.tenantId, tenantId),
          eq(watchlistEntries.userId, userId),
          eq(watchlistEntries.productId, productId),
        ),
      );
  }
}

export class PostgresReviewRepository implements ReviewRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  private map(row: typeof reviews.$inferSelect) {
    return {
      _id: row.id,
      tenantId: row.tenantId,
      product: row.productId,
      author: row.authorId,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(tenantId: string, reviewId: string) {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenantId), eq(reviews.id, reviewId)))
      .limit(1);
    return review ? this.map(review) : null;
  }

  async list(tenantId: string, productId: string, pagination: Pagination) {
    const where = and(
      eq(reviews.tenantId, tenantId),
      eq(reviews.productId, productId),
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt), desc(reviews.id))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db.select({ total: count() }).from(reviews).where(where),
    ]);
    return paginated(
      rows.map((review) => this.map(review)),
      total,
      pagination,
    );
  }

  async hasPurchasedProduct(
    tenantId: string,
    buyerId: string,
    productId: string,
  ) {
    const [purchase] = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(
        orders,
        and(
          eq(orders.tenantId, orderItems.tenantId),
          eq(orders.id, orderItems.orderId),
        ),
      )
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.productId, productId),
          eq(orders.buyerId, buyerId),
        ),
      )
      .limit(1);
    return Boolean(purchase);
  }

  async upsert(
    tenantId: string,
    productId: string,
    authorId: string,
    rating: number,
    comment: string,
    now: Date,
  ) {
    const [review] = await this.db
      .insert(reviews)
      .values({
        id: randomUUID(),
        tenantId,
        productId,
        authorId,
        rating,
        comment,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [reviews.tenantId, reviews.productId, reviews.authorId],
        set: { rating, comment, updatedAt: now },
      })
      .returning();
    return this.map(review);
  }
}
