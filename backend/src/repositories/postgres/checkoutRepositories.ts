import { randomUUID } from 'node:crypto';
import {
  and,
  count,
  desc,
  eq,
  exists,
  inArray,
  max,
  or,
  sql,
} from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import {
  cartItems,
  carts,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  products,
} from '@/database/schema';
import type { OrderStatus } from '@/orderStatus';
import type { CartRepository } from '@/repositories/cartRepository';
import type {
  CheckoutTransactionCoordinator,
  MutationRepositories,
} from '@/repositories/checkoutTransaction';
import type {
  CreateNotification,
  NotificationRepository,
} from '@/repositories/notificationRepository';
import type {
  CheckoutOrderItem,
  OrderItemRepository,
} from '@/repositories/orderItemRepository';
import type { OrderRepository } from '@/repositories/orderRepository';
import { PostgresProductRepository } from '@/repositories/postgres/productRepository';
import { PostgresAuditEventRepository } from '@/repositories/postgres/auditEventRepository';
import { PostgresSessionRepository } from '@/repositories/postgres/sessionRepository';
import { PostgresUserRepository } from '@/repositories/postgres/userRepository';
import { mapProductRow } from '@/repositories/mappers';
import { paginated } from '@/pagination';
import type { Pagination } from '@/pagination';
import type { OrderListData } from '@/validators/commerceValidator';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
type ProductDatabase = Database | TransactionDatabase;

export class PostgresCartRepository implements CartRepository {
  constructor(private readonly db: ProductDatabase) {}

  async get(tenantId: string, buyerId: string) {
    const [cart] = await this.db
      .select()
      .from(carts)
      .where(and(eq(carts.tenantId, tenantId), eq(carts.buyerId, buyerId)))
      .limit(1);
    if (!cart) return null;
    const items = await this.db
      .select()
      .from(cartItems)
      .where(
        and(eq(cartItems.tenantId, tenantId), eq(cartItems.cartId, cart.id)),
      );
    const productRows = items.length
      ? await this.db
          .select()
          .from(products)
          .where(
            and(
              eq(products.tenantId, tenantId),
              inArray(
                products.id,
                items.map((item) => item.productId),
              ),
            ),
          )
      : [];
    const productMap = new Map(
      productRows.map((product) => [product.id, mapProductRow(product)]),
    );
    return {
      tenantId,
      buyer: buyerId,
      items: items.map((item) => {
        const product = productMap.get(item.productId);
        /* v8 ignore next -- the tenant-qualified cart-item foreign key prevents a missing product. */
        if (!product) throw new Error('Cart product relation is invalid');
        return { product, quantity: item.quantity };
      }),
    };
  }

  async setItem(
    tenantId: string,
    buyerId: string,
    productId: string,
    quantity: number,
  ) {
    const now = new Date();
    await this.db
      .insert(carts)
      .values({
        id: randomUUID(),
        tenantId,
        buyerId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [carts.tenantId, carts.buyerId] });
    const [cart] = await this.db
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.tenantId, tenantId), eq(carts.buyerId, buyerId)))
      .limit(1);
    await this.db
      .insert(cartItems)
      .values({ tenantId, cartId: cart.id, productId, quantity })
      .onConflictDoUpdate({
        target: [cartItems.tenantId, cartItems.cartId, cartItems.productId],
        set: { quantity },
      });
  }

  async removeItem(tenantId: string, buyerId: string, productId: string) {
    const [cart] = await this.db
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.tenantId, tenantId), eq(carts.buyerId, buyerId)))
      .limit(1);
    if (!cart) return;
    await this.db
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.tenantId, tenantId),
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, productId),
        ),
      );
  }

  async findForCheckout(tenantId: string, buyerId: string) {
    const [cart] = await this.db
      .select()
      .from(carts)
      .where(and(eq(carts.tenantId, tenantId), eq(carts.buyerId, buyerId)))
      .limit(1)
      .for('update');
    if (!cart) return null;

    const items = await this.db
      .select()
      .from(cartItems)
      .where(
        and(eq(cartItems.tenantId, tenantId), eq(cartItems.cartId, cart.id)),
      )
      .orderBy(cartItems.productId);
    return {
      id: cart.id,
      tenantId: cart.tenantId,
      buyerId: cart.buyerId,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };
  }

  async clear(tenantId: string, cartId: string) {
    await this.db
      .delete(cartItems)
      .where(
        and(eq(cartItems.tenantId, tenantId), eq(cartItems.cartId, cartId)),
      );
    await this.db
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(and(eq(carts.tenantId, tenantId), eq(carts.id, cartId)));
  }
}

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly db: ProductDatabase) {}

  private async mapOrders(rows: Array<typeof orders.$inferSelect>) {
    if (!rows.length) return [];
    const history = await this.db
      .select()
      .from(orderStatusHistory)
      .where(
        and(
          eq(orderStatusHistory.tenantId, rows[0].tenantId),
          inArray(
            orderStatusHistory.orderId,
            rows.map((order) => order.id),
          ),
        ),
      )
      .orderBy(orderStatusHistory.sequence);
    return rows.map((order) => ({
      _id: order.id,
      tenantId: order.tenantId,
      buyer: order.buyerId,
      status: order.status as OrderStatus,
      statusHistory: history
        .filter((entry) => entry.orderId === order.id)
        .map((entry) => ({
          status: entry.status as OrderStatus,
          actor: entry.actorId,
          changedAt: entry.changedAt,
        })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }

  async createPlaced(tenantId: string, buyerId: string, now: Date) {
    const id = randomUUID();
    const [order] = await this.db
      .insert(orders)
      .values({
        id,
        tenantId,
        buyerId,
        status: 'placed',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await this.db.insert(orderStatusHistory).values({
      tenantId,
      orderId: id,
      sequence: 1,
      status: 'placed',
      actorId: buyerId,
      changedAt: now,
    });
    return {
      _id: order.id,
      tenantId: order.tenantId,
      buyer: order.buyerId,
      status: order.status as OrderStatus,
      statusHistory: [
        { status: 'placed' as const, actor: buyerId, changedAt: now },
      ],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async findById(tenantId: string, orderId: string) {
    const rows = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
      .limit(1);
    return (await this.mapOrders(rows))[0] || null;
  }

  async listByIds(tenantId: string, orderIds: string[]) {
    if (!orderIds.length) return [];
    const rows = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), inArray(orders.id, orderIds)))
      .orderBy(desc(orders.createdAt), desc(orders.id));
    return this.mapOrders(rows);
  }

  async listIdsByBuyer(tenantId: string, buyerId: string) {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.buyerId, buyerId)));
    return rows.map(({ id }) => id);
  }

  async listVisible(
    tenantId: string,
    userId: string,
    pagination: OrderListData,
  ) {
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
    const visibility =
      pagination.scope === 'buyer'
        ? eq(orders.buyerId, userId)
        : pagination.scope === 'seller'
          ? exists(sellerOrder)
          : or(eq(orders.buyerId, userId), exists(sellerOrder));
    const where = and(eq(orders.tenantId, tenantId), visibility);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db.select({ total: count() }).from(orders).where(where),
    ]);
    return paginated(await this.mapOrders(rows), total, pagination);
  }

  async updateStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    actorId: string,
    now: Date,
  ) {
    await this.db
      .update(orders)
      .set({ status, updatedAt: now })
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)));
    const [latest] = await this.db
      .select({ sequence: max(orderStatusHistory.sequence) })
      .from(orderStatusHistory)
      .where(
        and(
          eq(orderStatusHistory.tenantId, tenantId),
          eq(orderStatusHistory.orderId, orderId),
        ),
      );
    await this.db.insert(orderStatusHistory).values({
      tenantId,
      orderId,
      sequence: (latest.sequence || 0) + 1,
      status,
      actorId,
      changedAt: now,
    });
    return (await this.findById(tenantId, orderId))!;
  }
}

export class PostgresOrderItemRepository implements OrderItemRepository {
  constructor(private readonly db: ProductDatabase) {}

  async createMany(items: CheckoutOrderItem[], now: Date) {
    if (!items.length) return [];
    await this.db.insert(orderItems).values(
      items.map((item) => ({
        id: randomUUID(),
        tenantId: item.tenantId,
        orderId: item.order,
        productId: item.product,
        sellerId: item.seller,
        productName: item.productName,
        quantity: item.quantity,
        createdAt: now,
        updatedAt: now,
      })),
    );
    return items;
  }

  async listByOrderIds(tenantId: string, orderIds: string[]) {
    if (!orderIds.length) return [];
    const rows = await this.db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          inArray(orderItems.orderId, orderIds),
        ),
      );
    return rows.map((item) => ({
      tenantId: item.tenantId,
      order: item.orderId,
      product: item.productId,
      seller: item.sellerId,
      productName: item.productName,
      quantity: item.quantity,
    }));
  }

  async listOrderIdsBySeller(tenantId: string, sellerId: string) {
    const rows = await this.db
      .select({ orderId: orderItems.orderId })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.sellerId, sellerId),
        ),
      );
    return [...new Set(rows.map(({ orderId }) => orderId))];
  }

  async sellerOwnsOrder(tenantId: string, orderId: string, sellerId: string) {
    const [item] = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.orderId, orderId),
          eq(orderItems.sellerId, sellerId),
        ),
      )
      .limit(1);
    return Boolean(item);
  }
}

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly db: ProductDatabase) {}

  async create(notification: CreateNotification, now: Date) {
    await this.createMany([notification], now);
  }

  async createMany(values: CreateNotification[], now: Date) {
    if (!values.length) return;
    await this.db.insert(notifications).values(
      values.map((notification) => ({
        id: randomUUID(),
        tenantId: notification.tenantId,
        userId: notification.userId,
        message: notification.message,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  async list(tenantId: string, userId: string, pagination: Pagination) {
    const where = and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.userId, userId),
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db.select({ total: count() }).from(notifications).where(where),
    ]);
    return paginated(
      rows.map((notification) => ({
        _id: notification.id,
        tenantId: notification.tenantId,
        user: notification.userId,
        message: notification.message,
        read: notification.isRead,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      })),
      total,
      pagination,
    );
  }

  async countUnread(tenantId: string, userId: string) {
    const rows = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      );
    return rows.length;
  }

  async updateRead(
    tenantId: string,
    userId: string,
    notificationId: string,
    read: boolean,
  ) {
    const [notification] = await this.db
      .update(notifications)
      .set({ isRead: read, updatedAt: new Date() })
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.userId, userId),
          eq(notifications.id, notificationId),
        ),
      )
      .returning();
    return notification
      ? {
          _id: notification.id,
          tenantId: notification.tenantId,
          user: notification.userId,
          message: notification.message,
          read: notification.isRead,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
        }
      : null;
  }
}

function repositories(db: TransactionDatabase): MutationRepositories {
  return {
    audits: new PostgresAuditEventRepository(db),
    carts: new PostgresCartRepository(db),
    notifications: new PostgresNotificationRepository(db),
    orderItems: new PostgresOrderItemRepository(db),
    orders: new PostgresOrderRepository(db),
    products: new PostgresProductRepository(db),
    sessions: new PostgresSessionRepository(db),
    users: new PostgresUserRepository(db),
  };
}

export class PostgresCheckoutTransactionCoordinator implements CheckoutTransactionCoordinator {
  constructor(private readonly db: Database) {}

  run<T>(work: (repositories: MutationRepositories) => Promise<T>) {
    return this.db.transaction((transaction) =>
      work(repositories(transaction)),
    );
  }
}
