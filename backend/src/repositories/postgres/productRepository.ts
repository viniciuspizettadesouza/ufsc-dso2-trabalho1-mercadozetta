import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { products } from '@/database/schema';
import { mapProductRow } from '@/repositories/mappers';
import type {
  CreateProductRecord,
  ProductRepository,
} from '@/repositories/productRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
type ProductDatabase = Database | TransactionDatabase;

export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly db: ProductDatabase) {}

  async list(tenantId: string, sellerId?: string) {
    const rows = await this.db
      .select()
      .from(products)
      .where(
        sellerId
          ? and(
              eq(products.tenantId, tenantId),
              eq(products.sellerId, sellerId),
            )
          : eq(products.tenantId, tenantId),
      )
      .orderBy(desc(products.createdAt), desc(products.id));
    return rows.map(mapProductRow);
  }

  async create(product: CreateProductRecord) {
    const now = new Date();
    const [created] = await this.db
      .insert(products)
      .values({
        id: randomUUID(),
        tenantId: product.tenantId,
        sellerId: product.seller,
        name: product.name.toLowerCase(),
        description: product.description,
        category: product.category,
        subcategory: product.subcategory,
        inventory: product.inventory,
        imageUrl: product.image,
        status: product.status,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return mapProductRow(created);
  }

  async findById(tenantId: string, productId: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
      .limit(1);
    return product ? mapProductRow(product) : null;
  }

  async findActiveById(tenantId: string, productId: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.id, productId),
          eq(products.status, 'active'),
        ),
      )
      .limit(1);
    return product ? mapProductRow(product) : null;
  }

  async findByIds(tenantId: string, productIds: string[]) {
    if (!productIds.length) return [];
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(eq(products.tenantId, tenantId), inArray(products.id, productIds)),
      )
      .orderBy(products.id);
    return rows.map(mapProductRow);
  }

  async findByIdsForUpdate(tenantId: string, productIds: string[]) {
    if (!productIds.length) return [];
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(eq(products.tenantId, tenantId), inArray(products.id, productIds)),
      )
      .orderBy(products.id)
      .for('update');
    return rows.map(mapProductRow);
  }

  async decrementAvailableInventory(
    tenantId: string,
    productId: string,
    quantity: number,
  ) {
    const updated = await this.db
      .update(products)
      .set({
        inventory: sql`${products.inventory} - ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.id, productId),
          eq(products.status, 'active'),
          gte(products.inventory, quantity),
        ),
      )
      .returning({ id: products.id });
    return updated.length === 1;
  }
}
