import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  count,
  max,
} from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { productPriceHistory, products } from '@/database/schema';
import { mapProductRow } from '@/repositories/mappers';
import { paginated } from '@/pagination';
import type {
  CreateProductRecord,
  AppendProductPriceHistory,
  ProductListQuery,
  ProductRepository,
  UpdateProductRecord,
} from '@/repositories/productRepository';
import { resolveTenant } from '@/tenants';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
type ProductDatabase = Database | TransactionDatabase;

export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly db: ProductDatabase) {}

  async list(tenantId: string, query: ProductListQuery) {
    const conditions = [eq(products.tenantId, tenantId)];

    if (query.q) {
      const escapedSearch = query.q.replace(/[\\%_]/g, '\\$&');
      const pattern = `%${escapedSearch}%`;
      conditions.push(
        or(
          ilike(products.name, pattern),
          ilike(products.description, pattern),
        )!,
      );
    }
    if (query.category) conditions.push(eq(products.category, query.category));
    if (query.subcategory)
      conditions.push(eq(products.subcategory, query.subcategory));
    if (query.seller) conditions.push(eq(products.sellerId, query.seller));
    if (query.status) conditions.push(eq(products.status, query.status));
    if (query.availability === 'in_stock')
      conditions.push(gt(products.inventory, 0));
    if (query.availability === 'sold_out')
      conditions.push(eq(products.inventory, 0));

    const orderBy = (() => {
      switch (query.sort) {
        case 'created_asc':
          return [asc(products.createdAt), desc(products.id)];
        case 'name_asc':
          return [
            asc(products.name),
            desc(products.createdAt),
            desc(products.id),
          ];
        case 'inventory_desc':
          return [
            desc(products.inventory),
            desc(products.createdAt),
            desc(products.id),
          ];
        default:
          return [desc(products.createdAt), desc(products.id)];
      }
    })();

    const where = and(...conditions);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(where)
        .orderBy(...orderBy)
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return paginated(rows.map(mapProductRow), total, query);
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
        unitPriceMinor: BigInt(product.price.amountMinor),
        imageUrl: product.image,
        status: product.status,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return mapProductRow(created);
  }

  async updateOwned(
    tenantId: string,
    productId: string,
    sellerId: string,
    update: UpdateProductRecord,
  ) {
    const values = {
      ...(update.name === undefined ? {} : { name: update.name.toLowerCase() }),
      ...(update.description === undefined
        ? {}
        : { description: update.description }),
      ...(update.category === undefined ? {} : { category: update.category }),
      ...(update.subcategory === undefined
        ? {}
        : { subcategory: update.subcategory }),
      ...(update.image === undefined ? {} : { imageUrl: update.image }),
      ...(update.status === undefined ? {} : { status: update.status }),
      ...(update.inventory === undefined
        ? {}
        : { inventory: update.inventory }),
      ...(update.price === undefined
        ? {}
        : { unitPriceMinor: BigInt(update.price.amountMinor) }),
      updatedAt: new Date(),
    };
    const [updated] = await this.db
      .update(products)
      .set(values)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.id, productId),
          eq(products.sellerId, sellerId),
        ),
      )
      .returning();
    return updated ? mapProductRow(updated) : null;
  }

  async findById(tenantId: string, productId: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
      .limit(1);
    return product ? mapProductRow(product) : null;
  }

  async findByIdForUpdate(tenantId: string, productId: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
      .limit(1)
      .for('update');
    return product ? mapProductRow(product) : null;
  }

  async appendPriceHistory(entry: AppendProductPriceHistory) {
    const [{ latestSequence }] = await this.db
      .select({ latestSequence: max(productPriceHistory.sequence) })
      .from(productPriceHistory)
      .where(
        and(
          eq(productPriceHistory.tenantId, entry.tenantId),
          eq(productPriceHistory.productId, entry.productId),
        ),
      );
    const tenant = resolveTenant(entry.tenantId);
    if (!tenant || tenant.currencyCode !== entry.price.currency)
      throw new Error('Product price currency does not match its tenant');
    await this.db.insert(productPriceHistory).values({
      tenantId: entry.tenantId,
      productId: entry.productId,
      sequence: (latestSequence ?? 0) + 1,
      currencyCode: tenant.currencyCode,
      currencyMinorUnit: tenant.currencyMinorUnit,
      unitPriceMinor: BigInt(entry.price.amountMinor),
      actorId: entry.actorId,
      changedAt: entry.changedAt,
    });
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
          isNotNull(products.unitPriceMinor),
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
