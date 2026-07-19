import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  lte,
  ne,
  sql,
  sum,
} from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { auditEvents, orderItems, orders, products } from '@/database/schema';
import { paginated, type Pagination } from '@/pagination';
import type { SellerOperationsRepository } from '@/repositories/sellerOperationsRepository';

export class PostgresSellerOperationsRepository implements SellerOperationsRepository {
  constructor(private readonly db: Database) {}

  async getSummary(tenantId: string, sellerId: string, threshold: number) {
    const productScope = and(
      eq(products.tenantId, tenantId),
      eq(products.sellerId, sellerId),
      ne(products.status, 'archived'),
    );
    const sellerOrders = this.db
      .selectDistinct({ orderId: orderItems.orderId })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.sellerId, sellerId),
        ),
      )
      .as('seller_orders');
    const [productRows, orderRows, openOrderCount] = await Promise.all([
      this.db
        .select({
          productCount: count(),
          activeProductCount: sql<number>`count(*) filter (where ${products.status} = 'active')`,
          lowStockProductCount: sql<number>`count(*) filter (where ${products.inventory} <= ${threshold})`,
          inventoryUnits: sum(products.inventory),
        })
        .from(products)
        .where(productScope),
      this.db
        .select({
          orderCount: countDistinct(orderItems.orderId),
          orderedUnits: sum(orderItems.quantity),
        })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orderItems.sellerId, sellerId),
          ),
        ),
      this.db
        .select({ total: count() })
        .from(orders)
        .innerJoin(sellerOrders, eq(sellerOrders.orderId, orders.id))
        .where(
          and(
            eq(orders.tenantId, tenantId),
            inArray(orders.status, ['placed', 'confirmed', 'shipped']),
          ),
        ),
    ]);
    return {
      productCount: Number(productRows[0].productCount),
      activeProductCount: Number(productRows[0].activeProductCount),
      lowStockProductCount: Number(productRows[0].lowStockProductCount),
      inventoryUnits: Number(productRows[0].inventoryUnits ?? 0),
      orderCount: Number(orderRows[0].orderCount),
      openOrderCount: Number(openOrderCount[0].total),
      orderedUnits: Number(orderRows[0].orderedUnits ?? 0),
    };
  }

  async listLowStock(tenantId: string, sellerId: string, threshold: number) {
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.sellerId, sellerId),
          ne(products.status, 'archived'),
          lte(products.inventory, threshold),
        ),
      )
      .orderBy(products.inventory, products.name, products.id)
      .limit(100);
    return rows.map((product) => ({
      _id: product.id,
      name: product.name,
      inventory: product.inventory,
      status: product.status,
    }));
  }

  async listInventoryHistory(
    tenantId: string,
    sellerId: string,
    pagination: Pagination,
  ) {
    const where = and(
      eq(auditEvents.tenantId, tenantId),
      eq(auditEvents.resourceType, 'product'),
      inArray(auditEvents.eventType, [
        'inventory.set',
        'inventory.decremented',
      ]),
      eq(products.sellerId, sellerId),
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ event: auditEvents, productName: products.name })
        .from(auditEvents)
        .innerJoin(
          products,
          and(
            eq(products.tenantId, auditEvents.tenantId),
            eq(products.id, auditEvents.resourceId),
          ),
        )
        .where(where)
        .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ total: count() })
        .from(auditEvents)
        .innerJoin(
          products,
          and(
            eq(products.tenantId, auditEvents.tenantId),
            eq(products.id, auditEvents.resourceId),
          ),
        )
        .where(where),
    ]);
    return paginated(
      rows.map(({ event, productName }) => ({
        _id: event.id,
        eventType: event.eventType as 'inventory.set' | 'inventory.decremented',
        product: event.resourceId,
        productName,
        previousInventory: Number(event.metadata?.previousInventory ?? 0),
        nextInventory: Number(event.metadata?.nextInventory ?? 0),
        quantity:
          typeof event.metadata?.quantity === 'number'
            ? event.metadata.quantity
            : null,
        orderId:
          typeof event.metadata?.orderId === 'string'
            ? event.metadata.orderId
            : null,
        occurredAt: event.occurredAt,
      })),
      Number(total),
      pagination,
    );
  }
}
