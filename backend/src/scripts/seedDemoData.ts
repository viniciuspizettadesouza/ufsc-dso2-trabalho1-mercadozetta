import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import Product from '../model/product';
import User from '../model/user';
import { tenants } from '../tenants';
import type { ProductStatus } from '../productStatus';

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
};

const seedUsers: SeedUser[] = [
  {
    id: '660000000000000000000001',
    tenantId: 'mercadozetta',
    email: 'vinicius@mercadozetta.test',
    password: 'mercadozetta123',
    username: 'Ana Vendas',
    telephone: '(48) 99999-0101',
  },
  {
    id: '660000000000000000000002',
    tenantId: 'mercadozetta',
    email: 'bruno.buyer@mercadozetta.test',
    password: 'demo12345',
    username: 'Bruno Compras',
    telephone: '(48) 99999-0102',
  },
  {
    id: '660000000000000000000003',
    tenantId: 'campus-market',
    email: 'vinicius@campus-market.test',
    password: 'campusmarket123',
    username: 'Lia Campus',
    telephone: '(48) 99999-0201',
  },
  {
    id: '660000000000000000000004',
    tenantId: 'campus-market',
    email: 'mateus.buyer@campus.test',
    password: 'demo12345',
    username: 'Mateus Campus',
    telephone: '(48) 99999-0202',
  },
];

const seedProducts: SeedProduct[] = [
  {
    id: '670000000000000000000001',
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
  },
  {
    id: '670000000000000000000002',
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
  },
  {
    id: '670000000000000000000003',
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
  },
  {
    id: '670000000000000000000004',
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
  },
];

function requireMongoUri() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri)
    throw new Error('MONGODB_URI environment variable is required');

  return mongoUri;
}

function assertTenantExists(tenantId: string) {
  if (!tenants[tenantId])
    throw new Error(`Seed references unknown tenant: ${tenantId}`);
}

async function upsertUser(seed: SeedUser) {
  assertTenantExists(seed.tenantId);

  const existingUser = await User.findOne({
    tenantId: seed.tenantId,
    email: seed.email,
  }).select('+password');
  const user =
    existingUser ||
    new User({
      _id: new Types.ObjectId(seed.id),
      tenantId: seed.tenantId,
      email: seed.email,
    });

  user.password = seed.password;
  user.username = seed.username;
  user.telephone = seed.telephone;

  await user.save();
  return user;
}

async function upsertProduct(seed: SeedProduct, sellerId: Types.ObjectId) {
  assertTenantExists(seed.tenantId);

  await Product.updateOne(
    { _id: new Types.ObjectId(seed.id) },
    {
      $set: {
        tenantId: seed.tenantId,
        seller: sellerId,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        subcategory: seed.subcategory,
        inventory: seed.inventory,
        image: seed.image,
        status: seed.status,
      },
    },
    { upsert: true },
  );
}

export async function seedDemoData(options: { connect?: boolean } = {}) {
  if (options.connect !== false) await mongoose.connect(requireMongoUri());
  await User.init();
  await Product.init();

  const usersByTenantEmail = new Map<string, Types.ObjectId>();

  for (const seedUser of seedUsers) {
    const user = await upsertUser(seedUser);
    usersByTenantEmail.set(`${seedUser.tenantId}:${seedUser.email}`, user._id);
  }

  for (const seedProduct of seedProducts) {
    const sellerId = usersByTenantEmail.get(
      `${seedProduct.tenantId}:${seedProduct.sellerEmail}`,
    );

    if (!sellerId)
      throw new Error(
        `Missing seeded seller for ${seedProduct.tenantId}:${seedProduct.sellerEmail}`,
      );

    await upsertProduct(seedProduct, sellerId);
  }

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
      await mongoose.connection.close();
    });
}
