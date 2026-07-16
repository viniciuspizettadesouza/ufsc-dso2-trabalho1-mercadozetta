import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/database/schema';
import {
  cartItems,
  carts,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  reviews,
  sessions,
  users,
  watchlistEntries,
} from '@/database/schema';
import { seedDemoData } from '@/scripts/seedDemoData';

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString)
  throw new Error(
    'POSTGRESQL_URL is required for PostgreSQL integration tests',
  );
const pool = new Pool({ connectionString, max: 2 });
const db = drizzle({ client: pool, schema });

async function clearPostgres() {
  await db.delete(notifications);
  await db.delete(reviews);
  await db.delete(watchlistEntries);
  await db.delete(sessions);
  await db.delete(orderStatusHistory);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(cartItems);
  await db.delete(carts);
  await db.delete(products);
  await db.delete(users);
}

describe('demo data seeding', () => {
  beforeAll(async () => {
    await pool.query('select 1');
  });
  beforeEach(clearPostgres);
  afterEach(async () => {
    await clearPostgres();
  });
  afterAll(async () => {
    await pool.end();
  });

  it('is repeatable and tenant-scoped with PostgreSQL without deleting unrelated rows', async () => {
    const unrelatedUserId = randomUUID();
    const unrelatedProductId = randomUUID();
    const now = new Date();
    await db.insert(users).values({
      id: unrelatedUserId,
      tenantId: 'mercadozetta',
      email: 'postgres-unrelated@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      username: 'unrelated',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(products).values({
      id: unrelatedProductId,
      tenantId: 'mercadozetta',
      sellerId: unrelatedUserId,
      name: 'unrelated product',
      inventory: 9,
      imageUrl: 'https://example.com/unrelated.png',
      createdAt: now,
      updatedAt: now,
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await seedDemoData({ db });
    await seedDemoData({ db });

    const [storedUsers, storedProducts] = await Promise.all([
      db.select().from(users),
      db.select().from(products),
    ]);
    expect(storedUsers).toHaveLength(5);
    expect(storedProducts).toHaveLength(5);
    expect(
      storedUsers.filter(({ tenantId }) => tenantId === 'mercadozetta'),
    ).toHaveLength(3);
    expect(
      storedUsers.filter(({ tenantId }) => tenantId === 'campus-market'),
    ).toHaveLength(2);
    expect(
      storedProducts.filter(({ tenantId }) => tenantId === 'mercadozetta'),
    ).toHaveLength(3);
    expect(
      storedProducts.filter(({ tenantId }) => tenantId === 'campus-market'),
    ).toHaveLength(2);
    expect(
      storedProducts.find(({ id }) => id === unrelatedProductId),
    ).toMatchObject({ inventory: 9, sellerId: unrelatedUserId });

    const [seededSeller] = await db
      .select()
      .from(users)
      .where(eq(users.id, '66000000-0000-4000-8000-000000000001'));
    await expect(
      bcrypt.compare('mercadozetta123', seededSeller.passwordHash),
    ).resolves.toBe(true);
    expect(
      storedProducts
        .filter(({ id }) => id.startsWith('67000000'))
        .every((product) =>
          storedUsers.some(
            (user) =>
              user.id === product.sellerId &&
              user.tenantId === product.tenantId,
          ),
        ),
    ).toBe(true);

    log.mockRestore();
  });
});
