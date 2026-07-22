import { and, eq, exists, inArray, ne, or, sql } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import {
  carts,
  deliveryAddresses,
  notifications,
  orderItems,
  orders,
  products,
  watchlistEntries,
} from '@/database/schema';
import type { AccountLifecycleRepository } from '@/repositories/accountLifecycleRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

const activeOrderStatuses = ['placed', 'confirmed', 'shipped'];

export class PostgresAccountLifecycleRepository implements AccountLifecycleRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async hasActiveOrders(tenantId: string, userId: string) {
    const sellerOrder = this.db
      .select({ value: sql`1` })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, orders.tenantId),
          eq(orderItems.orderId, orders.id),
          eq(orderItems.sellerId, userId),
        ),
      );
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          inArray(orders.status, activeOrderStatuses),
          or(eq(orders.buyerId, userId), exists(sellerOrder)),
        ),
      )
      .limit(1);
    return rows.length === 1;
  }

  async archiveOwnedListings(tenantId: string, sellerId: string, now: Date) {
    const archived = await this.db
      .update(products)
      .set({ status: 'archived', updatedAt: now })
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.sellerId, sellerId),
          ne(products.status, 'archived'),
        ),
      )
      .returning({ id: products.id });
    return archived.length;
  }

  async deleteDisposableState(tenantId: string, userId: string) {
    const deletedCarts = await this.db
      .delete(carts)
      .where(and(eq(carts.tenantId, tenantId), eq(carts.buyerId, userId)))
      .returning({ id: carts.id });
    const deletedWatchlistEntries = await this.db
      .delete(watchlistEntries)
      .where(
        and(
          eq(watchlistEntries.tenantId, tenantId),
          eq(watchlistEntries.userId, userId),
        ),
      )
      .returning({ id: watchlistEntries.id });
    const deletedDeliveryAddresses = await this.db
      .delete(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
        ),
      )
      .returning({ id: deliveryAddresses.id });
    const deletedNotifications = await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
        ),
      )
      .returning({ id: notifications.id });
    return {
      carts: deletedCarts.length,
      deliveryAddresses: deletedDeliveryAddresses.length,
      watchlistEntries: deletedWatchlistEntries.length,
      notifications: deletedNotifications.length,
    };
  }
}
