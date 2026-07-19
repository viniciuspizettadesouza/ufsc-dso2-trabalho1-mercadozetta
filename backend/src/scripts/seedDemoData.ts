import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { and, eq, max } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { closePostgres, initializePostgres } from '@/database/postgres';
import { productPriceHistory, products, users } from '@/database/schema';
import { getPostgresRuntimeConfig } from '@/config/runtime';
import { tenants } from '@/tenants';
import type { ProductStatus } from '@/productStatus';

dotenv.config();

type SeedUser = {
  id: string;
  tenantId: string;
  email: string;
  password: string;
  username: string;
  telephone: string;
};

type SeedProduct = {
  id: string;
  tenantId: string;
  sellerEmail: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  inventory: number;
  image: string;
  status: ProductStatus;
  priceMinor: string;
};

const seedUsers: SeedUser[] = [
  {
    id: '66000000-0000-4000-8000-000000000001',
    tenantId: 'mercadozetta',
    email: 'vinicius@mercadozetta.test',
    password: 'mercadozetta123',
    username: 'Ana Vendas',
    telephone: '(48) 99999-0101',
  },
  {
    id: '66000000-0000-4000-8000-000000000002',
    tenantId: 'mercadozetta',
    email: 'bruno.buyer@mercadozetta.test',
    password: 'demo12345',
    username: 'Bruno Compras',
    telephone: '(48) 99999-0102',
  },
  {
    id: '66000000-0000-4000-8000-000000000003',
    tenantId: 'campus-market',
    email: 'vinicius@campus-market.test',
    password: 'campusmarket123',
    username: 'Lia Campus',
    telephone: '(48) 99999-0201',
  },
  {
    id: '66000000-0000-4000-8000-000000000004',
    tenantId: 'campus-market',
    email: 'mateus.buyer@campus.test',
    password: 'demo12345',
    username: 'Mateus Campus',
    telephone: '(48) 99999-0202',
  },
];

const seedProducts: SeedProduct[] = [
  {
    id: '67000000-0000-4000-8000-000000000001',
    tenantId: 'mercadozetta',
    sellerEmail: 'vinicius@mercadozetta.test',
    name: 'Notebook Dell Latitude',
    description:
      'Notebook revisado para estudos, trabalho remoto e demonstrações do marketplace.',
    category: 'electronics',
    subcategory: 'computers',
    inventory: 3,
    image:
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
    status: 'active',
    priceMinor: '89900',
  },
  {
    id: '67000000-0000-4000-8000-000000000002',
    tenantId: 'mercadozetta',
    sellerEmail: 'vinicius@mercadozetta.test',
    name: 'Cadeira Ergonomica',
    description:
      'Cadeira com regulagem de altura e apoio lombar para setup de estudos.',
    category: 'home-office',
    subcategory: 'chairs',
    inventory: 5,
    image:
      'https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=900&q=80',
    status: 'active',
    priceMinor: '24900',
  },
  {
    id: '67000000-0000-4000-8000-000000000003',
    tenantId: 'campus-market',
    sellerEmail: 'vinicius@campus-market.test',
    name: 'Calculadora Cientifica',
    description:
      'Calculadora para aulas de calculo, fisica e estatistica no campus.',
    category: 'study',
    subcategory: 'supplies',
    inventory: 8,
    image:
      'https://images.unsplash.com/photo-1611175694989-4870fafa4494?auto=format&fit=crop&w=900&q=80',
    status: 'active',
    priceMinor: '1899',
  },
  {
    id: '67000000-0000-4000-8000-000000000004',
    tenantId: 'campus-market',
    sellerEmail: 'vinicius@campus-market.test',
    name: 'Moletom CampusMarket',
    description:
      'Moletom demonstrativo para validar catalogo, filtros e paginas de vendedor.',
    category: 'apparel',
    subcategory: 'hoodies',
    inventory: 4,
    image:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80',
    status: 'active',
    priceMinor: '5490',
  },
];

function assertTenantExists(tenantId: string) {
  if (!tenants[tenantId])
    throw new Error(`Seed references unknown tenant: ${tenantId}`);
}

async function seedPostgresData(db: Database) {
  await db.transaction(async (transaction) => {
    const usersByTenantEmail = new Map<string, string>();
    const now = new Date();

    for (const seed of seedUsers) {
      assertTenantExists(seed.tenantId);
      const passwordHash = await bcrypt.hash(seed.password, 10);
      const [user] = await transaction
        .insert(users)
        .values({
          id: seed.id,
          tenantId: seed.tenantId,
          email: seed.email.toLowerCase(),
          passwordHash,
          username: seed.username.toLowerCase(),
          telephone: seed.telephone.toLowerCase(),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            tenantId: seed.tenantId,
            email: seed.email.toLowerCase(),
            passwordHash,
            username: seed.username.toLowerCase(),
            telephone: seed.telephone.toLowerCase(),
            updatedAt: now,
          },
        })
        .returning({ id: users.id });
      usersByTenantEmail.set(`${seed.tenantId}:${seed.email}`, user.id);
    }

    for (const seed of seedProducts) {
      assertTenantExists(seed.tenantId);
      const sellerId = usersByTenantEmail.get(
        `${seed.tenantId}:${seed.sellerEmail}`,
      );
      if (!sellerId)
        throw new Error(
          `Missing seeded seller for ${seed.tenantId}:${seed.sellerEmail}`,
        );

      const [existingProduct] = await transaction
        .select({ unitPriceMinor: products.unitPriceMinor })
        .from(products)
        .where(
          and(eq(products.tenantId, seed.tenantId), eq(products.id, seed.id)),
        )
        .limit(1);
      const unitPriceMinor = BigInt(seed.priceMinor);
      await transaction
        .insert(products)
        .values({
          id: seed.id,
          tenantId: seed.tenantId,
          sellerId,
          name: seed.name.toLowerCase(),
          description: seed.description,
          category: seed.category.toLowerCase(),
          subcategory: seed.subcategory.toLowerCase(),
          inventory: seed.inventory,
          unitPriceMinor,
          imageUrl: seed.image,
          status: seed.status,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            tenantId: seed.tenantId,
            sellerId,
            name: seed.name.toLowerCase(),
            description: seed.description,
            category: seed.category.toLowerCase(),
            subcategory: seed.subcategory.toLowerCase(),
            inventory: seed.inventory,
            unitPriceMinor,
            imageUrl: seed.image,
            status: seed.status,
            updatedAt: now,
          },
        });

      if (existingProduct?.unitPriceMinor !== unitPriceMinor) {
        const [{ latestSequence }] = await transaction
          .select({ latestSequence: max(productPriceHistory.sequence) })
          .from(productPriceHistory)
          .where(
            and(
              eq(productPriceHistory.tenantId, seed.tenantId),
              eq(productPriceHistory.productId, seed.id),
            ),
          );
        const tenant = tenants[seed.tenantId];
        await transaction.insert(productPriceHistory).values({
          tenantId: seed.tenantId,
          productId: seed.id,
          sequence: (latestSequence ?? 0) + 1,
          currencyCode: tenant.currencyCode,
          currencyMinorUnit: tenant.currencyMinorUnit,
          unitPriceMinor,
          actorId: sellerId,
          changedAt: now,
        });
      }
    }
  });
}

type SeedOptions = {
  db?: Database;
};

export async function seedDemoData(options: SeedOptions = {}) {
  const config = options.db ? undefined : getPostgresRuntimeConfig();
  if (!options.db && !config)
    throw new Error('POSTGRESQL_URL environment variable is required');
  const db = options.db || (await initializePostgres(config!));
  await seedPostgresData(db);

  console.log(
    `Seeded ${seedUsers.length} users and ${seedProducts.length} products.`,
  );
  console.log('Demo seller logins:');
  console.log('mercadozetta -> vinicius@mercadozetta.test / mercadozetta123');
  console.log('campus-market -> vinicius@campus-market.test / campusmarket123');
}

if (require.main === module) {
  seedDemoData()
    .catch((err) => {
      console.error('Demo seed failed', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePostgres();
    });
}
