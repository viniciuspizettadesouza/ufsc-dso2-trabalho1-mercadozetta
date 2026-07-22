import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/database/schema';
import { productPriceHistory, products, users } from '@/database/schema';
import { seedDemoData } from '@/scripts/seedDemoData';
import { resetPostgresTestData } from './postgresqlTestDatabase';

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString)
  throw new Error(
    'POSTGRESQL_URL is required for PostgreSQL integration tests',
  );
const pool = new Pool({ connectionString, max: 2 });
const db = drizzle({ client: pool, schema });

describe('demo data seeding', () => {
  beforeAll(async () => {
    await pool.query('select 1');
  });
  beforeEach(() => resetPostgresTestData(pool));
  afterEach(async () => {
    await resetPostgresTestData(pool);
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

    const [storedUsers, storedProducts, storedPriceHistory] = await Promise.all(
      [
        db.select().from(users),
        db.select().from(products),
        db.select().from(productPriceHistory),
      ],
    );
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
    expect(
      storedProducts
        .filter(({ id }) => id.startsWith('67000000'))
        .map(({ id, unitPriceMinor }) => ({ id, unitPriceMinor }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ).toEqual([
      {
        id: '67000000-0000-4000-8000-000000000001',
        unitPriceMinor: 89900n,
      },
      {
        id: '67000000-0000-4000-8000-000000000002',
        unitPriceMinor: 24900n,
      },
      {
        id: '67000000-0000-4000-8000-000000000003',
        unitPriceMinor: 1899n,
      },
      {
        id: '67000000-0000-4000-8000-000000000004',
        unitPriceMinor: 5490n,
      },
    ]);
    expect(storedPriceHistory).toHaveLength(4);
    expect(
      storedPriceHistory.map(({ tenantId, currencyCode, sequence }) => ({
        tenantId,
        currencyCode,
        sequence,
      })),
    ).toEqual([
      { tenantId: 'mercadozetta', currencyCode: 'USD', sequence: 1 },
      { tenantId: 'mercadozetta', currencyCode: 'USD', sequence: 1 },
      { tenantId: 'campus-market', currencyCode: 'EUR', sequence: 1 },
      { tenantId: 'campus-market', currencyCode: 'EUR', sequence: 1 },
    ]);
    expect(
      storedPriceHistory.every(
        ({ currencyMinorUnit }) => currencyMinorUnit === 2,
      ),
    ).toBe(true);

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
