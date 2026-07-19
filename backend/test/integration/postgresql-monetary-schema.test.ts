import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/database/schema';
import {
  maximumMoneyMinor,
  orderItems,
  orders,
  productPriceHistory,
  products,
  tenantCurrencies,
  tenants,
  users,
} from '@/database/schema';

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString)
  throw new Error(
    'POSTGRESQL_URL is required for PostgreSQL integration tests',
  );

const pool = new Pool({ connectionString, max: 2 });
const db = drizzle({ client: pool, schema });

async function clearPostgres() {
  await pool.query(`truncate table
    audit_events,
    mutation_idempotency,
    notifications,
    reviews,
    watchlist_entries,
    sessions,
    pending_email_changes,
    account_tokens,
    order_status_history,
    product_price_history,
    order_items,
    orders,
    cart_items,
    carts,
    products,
    users`);
}

async function expectConstraint(
  operation: Promise<unknown>,
  constraint: string,
) {
  try {
    await operation;
    throw new Error(`Expected constraint ${constraint} to reject the write`);
  } catch (error) {
    const databaseError =
      error instanceof Error && 'cause' in error ? error.cause : error;
    expect(databaseError).toMatchObject({ constraint });
  }
}

async function expectDatabaseMessage(
  operation: Promise<unknown>,
  message: string,
) {
  try {
    await operation;
    throw new Error(`Expected database error containing: ${message}`);
  } catch (error) {
    const databaseError =
      error instanceof Error && 'cause' in error ? error.cause : error;
    expect(databaseError).toMatchObject({
      message: expect.stringContaining(message),
    });
  }
}

async function insertUser(tenantId: string, email: string) {
  const id = randomUUID();
  const now = new Date();
  await db.insert(users).values({
    id,
    tenantId,
    email,
    passwordHash: 'not-used-by-monetary-schema-tests',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function insertProduct(tenantId: string, sellerId: string) {
  const id = randomUUID();
  const now = new Date();
  await db.insert(products).values({
    id,
    tenantId,
    sellerId,
    name: `Product ${id}`,
    inventory: 10,
    imageUrl: 'product.png',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe('PostgreSQL authoritative monetary schema', () => {
  beforeAll(async () => {
    await pool.query('select 1');
  });

  beforeEach(clearPostgres);

  afterAll(async () => {
    await pool.end();
  });

  it('anchors bounded product prices and append-only history to tenant currency', async () => {
    const tenantRows = await db
      .select({
        id: tenants.id,
        currencyCode: tenants.currencyCode,
        currencyMinorUnit: tenants.currencyMinorUnit,
      })
      .from(tenants);

    expect(tenantRows).toEqual(
      expect.arrayContaining([
        {
          id: 'mercadozetta',
          currencyCode: 'USD',
          currencyMinorUnit: 2,
        },
        {
          id: 'campus-market',
          currencyCode: 'EUR',
          currencyMinorUnit: 2,
        },
      ]),
    );
    const currencyRows = await db
      .select({
        tenantId: tenantCurrencies.tenantId,
        currencyCode: tenantCurrencies.currencyCode,
        currencyMinorUnit: tenantCurrencies.currencyMinorUnit,
      })
      .from(tenantCurrencies);
    expect(currencyRows).toEqual(
      expect.arrayContaining([
        {
          tenantId: 'mercadozetta',
          currencyCode: 'USD',
          currencyMinorUnit: 2,
        },
        {
          tenantId: 'campus-market',
          currencyCode: 'EUR',
          currencyMinorUnit: 2,
        },
      ]),
    );

    const sellerId = await insertUser(
      'mercadozetta',
      'money-seller@example.com',
    );
    const productId = await insertProduct('mercadozetta', sellerId);

    const [unpricedProduct] = await db
      .select({ unitPriceMinor: products.unitPriceMinor })
      .from(products)
      .where(eq(products.id, productId));
    expect(unpricedProduct.unitPriceMinor).toBeNull();

    await db
      .update(products)
      .set({ unitPriceMinor: maximumMoneyMinor })
      .where(eq(products.id, productId));
    await expectConstraint(
      pool.query('update products set unit_price_minor = $1 where id = $2', [
        '-1',
        productId,
      ]),
      'products_unit_price_minor_check',
    );

    const changedAt = new Date();
    await expectConstraint(
      db.insert(productPriceHistory).values({
        tenantId: 'mercadozetta',
        productId,
        sequence: 1,
        currencyCode: 'EUR',
        currencyMinorUnit: 2,
        unitPriceMinor: 0n,
        actorId: sellerId,
        changedAt,
      }),
      'product_price_history_tenant_currency_fkey',
    );

    await db.insert(productPriceHistory).values({
      tenantId: 'mercadozetta',
      productId,
      sequence: 1,
      currencyCode: 'USD',
      currencyMinorUnit: 2,
      unitPriceMinor: maximumMoneyMinor,
      actorId: sellerId,
      changedAt,
    });

    await expectDatabaseMessage(
      pool.query(
        'update product_price_history set unit_price_minor = 1 where tenant_id = $1 and product_id = $2',
        ['mercadozetta', productId],
      ),
      'product price history is append-only',
    );
    await expectDatabaseMessage(
      pool.query(
        'delete from product_price_history where tenant_id = $1 and product_id = $2',
        ['mercadozetta', productId],
      ),
      'product price history is append-only',
    );
  });

  it('keeps legacy orders unpriced and constrains immutable priced snapshots', async () => {
    const buyerId = await insertUser('mercadozetta', 'money-buyer@example.com');
    const sellerId = await insertUser(
      'mercadozetta',
      'snapshot-seller@example.com',
    );
    const productId = await insertProduct('mercadozetta', sellerId);
    const secondProductId = await insertProduct('mercadozetta', sellerId);
    const now = new Date();

    const legacyOrderId = randomUUID();
    await db.insert(orders).values({
      id: legacyOrderId,
      tenantId: 'mercadozetta',
      buyerId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(orderItems).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      orderId: legacyOrderId,
      productId,
      sellerId,
      productName: 'Legacy product snapshot',
      quantity: 2,
      createdAt: now,
      updatedAt: now,
    });

    const [legacyOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, legacyOrderId));
    expect(legacyOrder).toMatchObject({
      pricingState: 'legacy_unpriced',
      currencyCode: null,
      currencyMinorUnit: null,
      subtotalMinor: null,
      discountMinor: null,
      shippingMinor: null,
      totalMinor: null,
    });

    const pricedOrderId = randomUUID();
    await db.insert(orders).values({
      id: pricedOrderId,
      tenantId: 'mercadozetta',
      buyerId,
      pricingState: 'priced',
      currencyCode: 'USD',
      currencyMinorUnit: 2,
      subtotalMinor: 2_500n,
      discountMinor: 100n,
      shippingMinor: 250n,
      totalMinor: 2_650n,
      createdAt: now,
      updatedAt: now,
    });
    const pricedItemId = randomUUID();
    await db.insert(orderItems).values({
      id: pricedItemId,
      tenantId: 'mercadozetta',
      orderId: pricedOrderId,
      productId,
      sellerId,
      productName: 'Priced product snapshot',
      quantity: 2,
      pricingState: 'priced',
      unitPriceMinor: 1_250n,
      lineSubtotalMinor: 2_500n,
      createdAt: now,
      updatedAt: now,
    });

    await expectConstraint(
      db.insert(orderItems).values({
        id: randomUUID(),
        tenantId: 'mercadozetta',
        orderId: pricedOrderId,
        productId: secondProductId,
        sellerId,
        productName: 'Invalid subtotal',
        quantity: 2,
        pricingState: 'priced',
        unitPriceMinor: 500n,
        lineSubtotalMinor: 999n,
        createdAt: now,
        updatedAt: now,
      }),
      'order_items_monetary_shape_check',
    );

    await expectConstraint(
      db.insert(orders).values({
        id: randomUUID(),
        tenantId: 'mercadozetta',
        buyerId,
        pricingState: 'priced',
        currencyCode: 'USD',
        currencyMinorUnit: 2,
        subtotalMinor: 1_000n,
        discountMinor: 100n,
        shippingMinor: 50n,
        totalMinor: 951n,
        createdAt: now,
        updatedAt: now,
      }),
      'orders_monetary_amounts_check',
    );

    await expectDatabaseMessage(
      pool.query('update orders set total_minor = 0 where id = $1', [
        pricedOrderId,
      ]),
      'order monetary snapshot is immutable',
    );
    await expectDatabaseMessage(
      pool.query('update order_items set quantity = 1 where id = $1', [
        pricedItemId,
      ]),
      'order item snapshot is immutable',
    );
    await expectDatabaseMessage(
      pool.query('delete from order_items where id = $1', [pricedItemId]),
      'order item snapshot is immutable',
    );
  });
});
