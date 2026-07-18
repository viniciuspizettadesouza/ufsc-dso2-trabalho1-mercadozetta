import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import * as schema from '@/database/schema';
import { createApp } from '@/app';
import { createPostgresComposition } from '@/compositionRoot';
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
import { isUuid } from '@/ids';
import { PostgresProductRepository } from '@/repositories/postgres/productRepository';
import { PostgresUserRepository } from '@/repositories/postgres/userRepository';
import {
  PostgresCartRepository,
  PostgresCheckoutTransactionCoordinator,
  PostgresNotificationRepository,
  PostgresOrderItemRepository,
  PostgresOrderRepository,
} from '@/repositories/postgres/checkoutRepositories';
import {
  PostgresReviewRepository,
  PostgresWatchlistRepository,
} from '@/repositories/postgres/commerceRepositories';
import { PostgresSessionRepository } from '@/repositories/postgres/sessionRepository';
import {
  createAuthService,
  type AuthSessionService,
} from '@/services/authService';
import { createProductService } from '@/services/productService';
import {
  createCartCommerceService,
  createCommerceProductService,
  createNotificationCommerceService,
  createOrderCommerceService,
  createReviewCommerceService,
  createWatchlistCommerceService,
} from '@/services/commerceService';
import { createUserService } from '@/services/userService';
import { createSessionService } from '@/services/sessionService';
import { createRoutes } from '@/routes';

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString)
  throw new Error(
    'POSTGRESQL_URL is required for PostgreSQL integration tests',
  );

const pool = new Pool({ connectionString, max: 2 });
const db = drizzle({ client: pool, schema });
const userRepository = new PostgresUserRepository(db);
const productRepository = new PostgresProductRepository(db);
const userService = createUserService(userRepository);
const productService = createProductService(productRepository, userService);
const checkoutService = createCommerceProductService(
  productRepository,
  new PostgresCheckoutTransactionCoordinator(db),
);
const cartService = createCartCommerceService(
  new PostgresCartRepository(db),
  productRepository,
);
const notificationService = createNotificationCommerceService(
  new PostgresNotificationRepository(db),
);
const orderService = createOrderCommerceService(
  new PostgresOrderRepository(db),
  new PostgresOrderItemRepository(db),
  new PostgresNotificationRepository(db),
);
const watchlistService = createWatchlistCommerceService(
  new PostgresWatchlistRepository(db),
  productRepository,
);
const reviewService = createReviewCommerceService(
  new PostgresReviewRepository(db),
  productRepository,
  new PostgresNotificationRepository(db),
);
const postgresSessions = new PostgresSessionRepository(db);
const postgresSessionService = createSessionService(
  userRepository,
  postgresSessions,
);
const postgresApp = createApp(
  createRoutes({
    ...createPostgresComposition(db),
    readiness: async () => ({
      ready: true,
      checks: { postgresql: 'connected' },
    }),
  }),
);

const userPayload = {
  email: 'seller@example.com',
  password: 'secret123',
  username: 'Seller',
  telephone: '123',
};
const firstPage = { limit: 20, offset: 0, scope: 'all' as const };

function authCookies(response: request.Response) {
  const values = response.headers['set-cookie'] || [];
  const cookies = Array.isArray(values) ? values : [values];
  const csrf = cookies
    .find((cookie) => cookie.startsWith('mz_csrf='))
    ?.split(';', 1)[0]
    .slice('mz_csrf='.length);
  return { cookie: cookies.map((cookie) => cookie.split(';', 1)[0]), csrf };
}

describe('PostgreSQL user and product repositories', () => {
  beforeAll(async () => {
    await pool.query('select 1');
  });

  beforeEach(async () => {
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
  });

  afterAll(async () => {
    await pool.end();
  });

  it('preserves tenant-qualified email uniqueness and public user errors', async () => {
    const mercadozettaUser = await userService.createUser(
      userPayload,
      'mercadozetta',
    );
    const campusUser = await userService.createUser(
      userPayload,
      'campus-market',
    );

    expect(isUuid(mercadozettaUser._id)).toBe(true);
    expect(isUuid(campusUser._id)).toBe(true);
    expect(mercadozettaUser).not.toHaveProperty('password');
    await expect(
      userService.createUser(userPayload, 'mercadozetta'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'USER_EXISTS' });

    const concurrentPayload = {
      ...userPayload,
      email: 'concurrent@example.com',
    };
    const concurrentCreates = await Promise.allSettled([
      userService.createUser(concurrentPayload, 'mercadozetta'),
      userService.createUser(concurrentPayload, 'mercadozetta'),
    ]);
    expect(
      concurrentCreates.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      concurrentCreates.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([{ reason: { statusCode: 400, code: 'USER_EXISTS' } }]);
    await expect(
      userService.getPublicSellerProfile(mercadozettaUser._id, 'campus-market'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SELLER_NOT_FOUND',
    });

    const [stored] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, mercadozettaUser._id));
    expect(stored.passwordHash).not.toBe(userPayload.password);
    await expect(
      bcrypt.compare(userPayload.password, stored.passwordHash),
    ).resolves.toBe(true);
  });

  it('enforces tenant ownership and maps product rows to the current API shape', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const otherTenantSeller = await userService.createUser(
      { ...userPayload, email: 'campus-seller@example.com' },
      'campus-market',
    );
    const product = await productService.createProduct(
      {
        name: ' Keyboard ',
        description: 'Mechanical keyboard',
        inventory: 2,
        image: 'keyboard.png',
      },
      seller._id,
      'mercadozetta',
    );

    expect(isUuid(product._id)).toBe(true);
    expect(product).toMatchObject({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'keyboard',
      image: 'keyboard.png',
      inventory: 2,
      status: 'active',
    });
    await expect(
      productService.getProductById(product._id, 'campus-market'),
    ).resolves.toBeNull();
    await expect(
      productService.listProductsBySeller(seller._id, 'mercadozetta'),
    ).resolves.toMatchObject({
      items: [{ _id: product._id, seller: seller._id }],
    });

    try {
      await productService.createProduct(
        { name: 'Desk', inventory: 1, image: 'desk.png' },
        otherTenantSeller._id,
        'mercadozetta',
      );
      throw new Error('Expected cross-tenant product ownership to fail');
    } catch (error) {
      expect(error).toMatchObject({ cause: { code: '23503' } });
    }
  });

  it('filters and sorts tenant catalog rows in PostgreSQL', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const otherSeller = await userService.createUser(
      { ...userPayload, email: 'other-seller@example.com' },
      'mercadozetta',
    );
    const campusSeller = await userService.createUser(
      { ...userPayload, email: 'campus-catalog@example.com' },
      'campus-market',
    );

    const keyboard = await productService.createProduct(
      {
        name: 'Keyboard',
        description: 'Mechanical switches',
        category: 'Peripherals',
        subcategory: 'Keyboards',
        inventory: 3,
        image: 'keyboard.png',
      },
      seller._id,
      'mercadozetta',
    );
    const cable = await productService.createProduct(
      {
        name: 'Cable',
        description: 'Braided with 100% recycled fibers',
        category: 'Peripherals',
        subcategory: 'Cables',
        inventory: 0,
        image: 'cable.png',
        status: 'sold_out',
      },
      seller._id,
      'mercadozetta',
    );
    const desk = await productService.createProduct(
      {
        name: 'Desk',
        description: 'Standing desk',
        category: 'Furniture',
        subcategory: 'Desks',
        inventory: 5,
        image: 'desk.png',
        status: 'paused',
      },
      seller._id,
      'mercadozetta',
    );
    const mouse = await productService.createProduct(
      {
        name: 'Mouse',
        category: 'Peripherals',
        inventory: 9,
        image: 'mouse.png',
      },
      otherSeller._id,
      'mercadozetta',
    );
    await productService.createProduct(
      {
        name: 'Campus keyboard',
        category: 'Peripherals',
        inventory: 99,
        image: 'campus-keyboard.png',
      },
      campusSeller._id,
      'campus-market',
    );

    const creationTimes = [
      [keyboard._id, '2025-01-01T00:00:00.000Z'],
      [cable._id, '2025-01-02T00:00:00.000Z'],
      [desk._id, '2025-01-03T00:00:00.000Z'],
      [mouse._id, '2025-01-04T00:00:00.000Z'],
    ] as const;
    for (const [id, createdAt] of creationTimes)
      await db
        .update(products)
        .set({ createdAt: new Date(createdAt) })
        .where(eq(products.id, id));

    await expect(
      productService.listProducts('mercadozetta', {
        q: 'MECHANICAL',
        category: 'PERIPHERALS',
        subcategory: 'KEYBOARDS',
        seller: seller._id,
        status: 'active',
        availability: 'in_stock',
        sort: 'name_asc',
      }),
    ).resolves.toMatchObject({ items: [{ _id: keyboard._id }] });
    await expect(
      productService.listProducts('mercadozetta', {
        q: '100%',
        availability: 'sold_out',
      }),
    ).resolves.toMatchObject({ items: [{ _id: cable._id }] });
    await expect(
      productService.listProducts('mercadozetta', {
        status: 'paused',
      }),
    ).resolves.toMatchObject({ items: [{ _id: desk._id }] });

    const inventoryOrder = await productService.listProducts('mercadozetta', {
      sort: 'inventory_desc',
    });
    expect(inventoryOrder.items.map(({ _id }) => _id)).toEqual([
      mouse._id,
      desk._id,
      keyboard._id,
      cable._id,
    ]);
    const oldestFirst = await productService.listProducts('mercadozetta', {
      sort: 'created_asc',
    });
    expect(oldestFirst.items.map(({ _id }) => _id)).toEqual([
      keyboard._id,
      cable._id,
      desk._id,
      mouse._id,
    ]);
    const newestFirst = await productService.listProducts('mercadozetta');
    expect(newestFirst.items.map(({ _id }) => _id)).toEqual([
      mouse._id,
      desk._id,
      cable._id,
      keyboard._id,
    ]);
    await expect(
      productService.listProductsBySeller(seller._id, 'mercadozetta', {
        status: 'active',
      }),
    ).resolves.toMatchObject({ items: [{ _id: keyboard._id }] });

    const firstInventoryPage = await productService.listProducts(
      'mercadozetta',
      { sort: 'inventory_desc', limit: 2, offset: 0 },
    );
    expect(firstInventoryPage).toMatchObject({
      items: [{ _id: mouse._id }, { _id: desk._id }],
      page: { limit: 2, offset: 0, total: 4, hasMore: true },
    });
    const secondInventoryPage = await productService.listProducts(
      'mercadozetta',
      { sort: 'inventory_desc', limit: 2, offset: 2 },
    );
    expect(secondInventoryPage).toMatchObject({
      items: [{ _id: keyboard._id }, { _id: cable._id }],
      page: { limit: 2, offset: 2, total: 4, hasMore: false },
    });

    const catalogIndexes = await pool.query<{ indexname: string }>(
      "select indexname from pg_indexes where tablename = 'products'",
    );
    expect(catalogIndexes.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'products_catalog_idx',
        'products_seller_idx',
        'products_category_idx',
        'products_name_idx',
        'products_inventory_idx',
      ]),
    );
  });

  it('enforces seller-owned product management and inventory lifecycle rules', async () => {
    await request(postgresApp)
      .get('/users/not-a-uuid')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'INVALID_SELLER_ID' });
      });

    const sellerRegistration = await request(postgresApp)
      .post('/users')
      .send(userPayload)
      .expect(201);
    const attackerEmail = 'product-attacker@example.com';
    await request(postgresApp)
      .post('/users')
      .send({ ...userPayload, email: attackerEmail, username: 'Attacker' })
      .expect(201);
    const sellerLogin = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: userPayload.email, password: userPayload.password })
      .expect(200);
    const attackerLogin = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: attackerEmail, password: userPayload.password })
      .expect(200);
    const sellerAuth = authCookies(sellerLogin);
    const attackerAuth = authCookies(attackerLogin);
    const created = await request(postgresApp)
      .post('/products')
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ name: 'Managed', inventory: 2, image: 'managed.png' })
      .expect(201);
    const productId = created.body._id;

    await request(postgresApp)
      .patch(`/products/${productId}`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({
        name: 'Updated managed',
        category: 'Office',
        seller: attackerLogin.body.user._id,
        tenantId: 'campus-market',
        inventory: 999,
        status: 'archived',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'updated managed',
          category: 'office',
          seller: sellerRegistration.body._id,
          tenantId: 'mercadozetta',
          inventory: 2,
          status: 'active',
        });
      });

    await request(postgresApp)
      .patch(`/products/${productId}`)
      .set('Cookie', attackerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', attackerAuth.csrf!)
      .send({ name: 'Stolen' })
      .expect(403);

    await request(postgresApp)
      .patch(`/products/${productId}/inventory`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ inventory: 0 })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ inventory: 0, status: 'sold_out' }),
      );
    await request(postgresApp)
      .patch(`/products/${productId}/status`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ status: 'active' })
      .expect(409);
    await request(postgresApp)
      .patch(`/products/${productId}/inventory`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ inventory: 4 })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ inventory: 4, status: 'active' }),
      );
    await request(postgresApp)
      .patch(`/products/${productId}/status`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ status: 'archived' })
      .expect(200);
    await request(postgresApp)
      .patch(`/products/${productId}/status`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ status: 'active' })
      .expect(200);
  });

  it('serves the existing HTTP contract through one PostgreSQL composition', async () => {
    const sellerRegistration = await request(postgresApp)
      .post('/users')
      .send(userPayload)
      .expect(201);
    const sellerId = sellerRegistration.body._id;
    const login = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: userPayload.email, password: userPayload.password })
      .expect(200);
    const sellerAuth = authCookies(login);
    expect(login.body).toMatchObject({
      user: { _id: sellerId, tenantId: 'mercadozetta' },
      session: { id: expect.any(String) },
    });
    expect(login.body).not.toHaveProperty('accessToken');
    expect(sellerAuth.csrf).toBeTruthy();

    const createdProduct = await request(postgresApp)
      .post('/products')
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({
        name: 'HTTP PostgreSQL product',
        description: 'Created through composed routes',
        inventory: 2,
        image: 'postgres-http.png',
      })
      .expect(201);
    const productId = createdProduct.body._id;
    await request(postgresApp)
      .get(`/products/${productId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          _id: productId,
          seller: sellerId,
          sellerProfile: { _id: sellerId },
        });
      });

    const buyerEmail = 'http-buyer@example.com';
    await request(postgresApp)
      .post('/users')
      .send({ ...userPayload, email: buyerEmail, username: 'Buyer' })
      .expect(201);
    const buyerLogin = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: buyerEmail, password: userPayload.password })
      .expect(200);
    const buyerAuth = authCookies(buyerLogin);
    await request(postgresApp)
      .put('/cart/items')
      .set('Cookie', buyerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', buyerAuth.csrf!)
      .send({ productId, quantity: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          tenantId: 'mercadozetta',
          buyer: buyerLogin.body.user._id,
          items: [{ product: { _id: productId }, quantity: 1 }],
        });
        expect(body).not.toHaveProperty('_id');
      });
    await request(postgresApp)
      .get('/ready')
      .expect(200, {
        status: 'ready',
        checks: { postgresql: 'connected' },
      });
  });

  it('authenticates, restores state, and invalidates tokens through PostgreSQL', async () => {
    const user = await userService.createUser(userPayload, 'mercadozetta');
    const sessionDependencies: AuthSessionService = {
      createSession: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        csrfToken: 'csrf-token',
        session: { id: 'session-1' },
      }),
      getSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
      revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    };
    const authService = createAuthService(userRepository, sessionDependencies);

    const authenticated = await authService.authenticate(
      { email: ' SELLER@EXAMPLE.COM ', password: 'secret123' },
      'mercadozetta',
      'PostgreSQL integration',
    );
    expect(authenticated.user).toMatchObject({
      _id: user._id,
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
    });
    expect(authenticated.user).not.toHaveProperty('passwordHash');
    expect(authenticated.user).not.toHaveProperty('tokenVersion');
    expect(sessionDependencies.createSession).toHaveBeenCalledWith(
      user._id,
      'mercadozetta',
      0,
      'PostgreSQL integration',
      expect.any(Date),
    );

    await expect(
      authService.getSessionState('session-1', user._id, 'mercadozetta'),
    ).resolves.toMatchObject({
      user: { _id: user._id, email: 'seller@example.com' },
      session: { id: 'session-1' },
    });
    await expect(
      userRepository.hasTokenVersion('mercadozetta', user._id, 0),
    ).resolves.toBe(true);

    await authService.logout(user._id, 'mercadozetta');
    await expect(
      userRepository.hasTokenVersion('mercadozetta', user._id, 0),
    ).resolves.toBe(false);
    await expect(
      userRepository.findTokenVersion('mercadozetta', user._id),
    ).resolves.toBe(1);
    expect(sessionDependencies.revokeAllSessions).toHaveBeenCalledWith(
      user._id,
      'mercadozetta',
      expect.any(Date),
    );
  });

  it('preserves session rotation, replay, revocation, and cleanup semantics', async () => {
    const user = await userService.createUser(userPayload, 'mercadozetta');
    const now = new Date('2026-07-15T12:00:00.000Z');
    const created = await postgresSessionService.createSession(
      user._id,
      'mercadozetta',
      0,
      `${'PostgreSQL browser '.repeat(10)}\r\nInjected`,
      now,
    );

    const [stored] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, created.session.id));
    expect(stored.refreshTokenHash).not.toBe(created.refreshToken);
    expect(stored.refreshTokenSecretVersion).toBe('current');
    expect(stored.userAgentLabel).not.toContain('\n');
    expect(stored.userAgentLabel).toHaveLength(120);
    await expect(
      postgresSessionService.getSession(
        created.session.id,
        user._id,
        'mercadozetta',
        now,
      ),
    ).resolves.toMatchObject({ id: created.session.id });
    await expect(
      postgresSessionService.listSessions(user._id, 'campus-market', now),
    ).resolves.toEqual([]);
    await expect(
      postgresSessionService.rotateSession(
        created.refreshToken,
        'campus-market',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    const refreshAt = new Date(now.getTime() + 1000);
    const attempts = await Promise.allSettled([
      postgresSessionService.rotateSession(
        created.refreshToken,
        'mercadozetta',
        refreshAt,
      ),
      postgresSessionService.rotateSession(
        created.refreshToken,
        'mercadozetta',
        refreshAt,
      ),
    ]);
    expect(
      attempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([
      { reason: { statusCode: 409, code: 'REFRESH_ALREADY_ROTATED' } },
    ]);
    expect(
      (await db.select().from(sessions).where(eq(sessions.id, stored.id)))[0],
    ).toMatchObject({
      rotationCounter: 1,
      previousRefreshTokenHash: stored.refreshTokenHash,
      previousRefreshTokenSecretVersion: 'current',
      revokedAt: null,
    });

    await expect(
      postgresSessionService.rotateSession(
        created.refreshToken,
        'mercadozetta',
        new Date(now.getTime() + 7000),
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_REUSED',
    });
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        user._id,
        created.session.id,
        0,
        refreshAt,
      ),
    ).resolves.toBe(false);

    const revocable = await postgresSessionService.createSession(
      user._id,
      'mercadozetta',
      0,
      undefined,
      now,
    );
    await postgresSessionService.revokeSession(
      revocable.session.id,
      user._id,
      'mercadozetta',
      'user_revoked',
      now,
    );
    await expect(
      postgresSessionService.revokeSession(
        revocable.session.id,
        user._id,
        'mercadozetta',
        'user_revoked',
        now,
      ),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });

    const allSessions = await postgresSessionService.createSession(
      user._id,
      'mercadozetta',
      0,
      undefined,
      now,
    );
    await postgresSessionService.revokeAllSessions(
      user._id,
      'mercadozetta',
      now,
    );
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        user._id,
        allSessions.session.id,
        0,
        now,
      ),
    ).resolves.toBe(false);
    await expect(
      postgresSessionService.deleteExpiredSessions(new Date('2099-01-01')),
    ).resolves.toBe(3);
  });

  it('rolls back inventory and serializes concurrent final-unit reservations', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Final unit',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 1,
      image: 'final-unit.png',
      status: 'active',
    });

    await expect(
      db.transaction(async (transaction) => {
        const repository = new PostgresProductRepository(transaction);
        const [locked] = await repository.findByIdsForUpdate('mercadozetta', [
          product._id,
        ]);
        expect(locked.inventory).toBe(1);
        await expect(
          repository.decrementAvailableInventory(
            'mercadozetta',
            product._id,
            1,
          ),
        ).resolves.toBe(true);
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');
    await expect(
      productRepository.findById('mercadozetta', product._id),
    ).resolves.toMatchObject({ inventory: 1 });

    const reserveFinalUnit = () =>
      db.transaction(async (transaction) => {
        const repository = new PostgresProductRepository(transaction);
        const [locked] = await repository.findByIdsForUpdate('mercadozetta', [
          product._id,
        ]);
        if (!locked || locked.status !== 'active' || locked.inventory < 1)
          return false;
        return repository.decrementAvailableInventory(
          'mercadozetta',
          product._id,
          1,
        );
      });

    await expect(
      Promise.all([reserveFinalUnit(), reserveFinalUnit()]),
    ).resolves.toEqual(expect.arrayContaining([true, false]));
    await expect(
      productRepository.findById('mercadozetta', product._id),
    ).resolves.toMatchObject({ inventory: 0 });
  });

  it('commits one complete checkout for two concurrent final-unit buyers', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const firstBuyer = await userService.createUser(
      { ...userPayload, email: 'first-buyer@example.com' },
      'mercadozetta',
    );
    const secondBuyer = await userService.createUser(
      { ...userPayload, email: 'second-buyer@example.com' },
      'mercadozetta',
    );
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Concurrent final unit',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 1,
      image: 'final-unit.png',
      status: 'active',
    });
    const buyerCarts = await Promise.all(
      [firstBuyer, secondBuyer].map(async (buyer) => {
        const cartId = randomUUID();
        const now = new Date();
        await db.insert(carts).values({
          id: cartId,
          tenantId: 'mercadozetta',
          buyerId: buyer._id,
          createdAt: now,
          updatedAt: now,
        });
        await db.insert(cartItems).values({
          tenantId: 'mercadozetta',
          cartId,
          productId: product._id,
          quantity: 1,
        });
        return { buyerId: buyer._id, cartId };
      }),
    );

    const attempts = await Promise.allSettled(
      buyerCarts.map(({ buyerId }) =>
        checkoutService.createOrder(buyerId, 'mercadozetta'),
      ),
    );
    expect(
      attempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([
      {
        reason: {
          statusCode: 409,
          code: 'INSUFFICIENT_INVENTORY',
        },
      },
    ]);
    const placedOrder = attempts.find(
      (attempt) => attempt.status === 'fulfilled',
    );
    expect(placedOrder?.status).toBe('fulfilled');
    if (placedOrder?.status !== 'fulfilled')
      throw new Error('Expected one placed order');
    expect(placedOrder.value).toMatchObject({
      tenantId: 'mercadozetta',
      status: 'placed',
      items: [
        {
          tenantId: 'mercadozetta',
          order: placedOrder.value._id,
          product: product._id,
          seller: seller._id,
          productName: 'concurrent final unit',
          quantity: 1,
        },
      ],
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });

    const [storedProduct, storedOrders, storedItems, storedHistory, notices] =
      await Promise.all([
        productRepository.findById('mercadozetta', product._id),
        db.select().from(orders),
        db.select().from(orderItems),
        db.select().from(orderStatusHistory),
        db.select().from(notifications),
      ]);
    expect(storedProduct?.inventory).toBe(0);
    expect(storedOrders).toHaveLength(1);
    expect(storedItems).toMatchObject([
      {
        orderId: storedOrders[0].id,
        productId: product._id,
        sellerId: seller._id,
        productName: 'concurrent final unit',
        quantity: 1,
      },
    ]);
    expect(storedHistory).toMatchObject([
      {
        orderId: storedOrders[0].id,
        sequence: 1,
        status: 'placed',
        actorId: storedOrders[0].buyerId,
      },
    ]);
    expect(notices).toHaveLength(2);
    expect(notices.map(({ userId }) => userId).sort()).toEqual(
      [seller._id, storedOrders[0].buyerId].sort(),
    );

    const remainingCartItems = await db.select().from(cartItems);
    const winningCart = buyerCarts.find(
      ({ buyerId }) => buyerId === storedOrders[0].buyerId,
    );
    const losingCart = buyerCarts.find(
      ({ buyerId }) => buyerId !== storedOrders[0].buyerId,
    );
    expect(
      remainingCartItems.some(({ cartId }) => cartId === winningCart?.cartId),
    ).toBe(false);
    expect(
      remainingCartItems.some(({ cartId }) => cartId === losingCart?.cartId),
    ).toBe(true);

    await expect(
      orderService.listOrders(seller._id, 'mercadozetta', firstPage),
    ).resolves.toMatchObject({
      items: [
        {
          _id: storedOrders[0].id,
          items: [{ product: product._id, seller: seller._id }],
        },
      ],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    await expect(
      orderService.listOrders(losingCart!.buyerId, 'mercadozetta', firstPage),
    ).resolves.toMatchObject({ items: [] });
    const advancedOrder = await orderService.updateOrderStatus(
      seller._id,
      'mercadozetta',
      storedOrders[0].id,
      'confirmed',
    );
    expect(advancedOrder).toMatchObject({
      status: 'confirmed',
      items: [{ product: product._id, seller: seller._id }],
    });

    const buyerNotices = await notificationService.listNotifications(
      storedOrders[0].buyerId,
      'mercadozetta',
      firstPage,
    );
    expect(buyerNotices.items.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        `Order ${storedOrders[0].id} created`,
        `Order ${storedOrders[0].id} is now confirmed`,
      ]),
    );
    expect(buyerNotices.page).toMatchObject({ total: 2, hasMore: false });
    const sellerNotices = await notificationService.listNotifications(
      seller._id,
      'mercadozetta',
      firstPage,
    );
    await expect(
      notificationService.countUnreadNotifications(seller._id, 'mercadozetta'),
    ).resolves.toBe(sellerNotices.items.length);
    const updatedNotice = await notificationService.updateNotificationRead(
      seller._id,
      'mercadozetta',
      sellerNotices.items[0]._id,
      true,
    );
    expect(updatedNotice).toMatchObject({
      _id: sellerNotices.items[0]._id,
      tenantId: 'mercadozetta',
      user: seller._id,
      read: true,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await expect(
      notificationService.updateNotificationRead(
        losingCart!.buyerId,
        'mercadozetta',
        sellerNotices.items[0]._id,
        true,
      ),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });

    await expect(
      cartService.getCart(losingCart!.buyerId, 'mercadozetta'),
    ).resolves.toMatchObject({ items: [{ quantity: 1 }] });
    await cartService.removeCartItem(
      losingCart!.buyerId,
      'mercadozetta',
      product._id,
    );
    await expect(
      cartService.getCart(losingCart!.buyerId, 'mercadozetta'),
    ).resolves.toMatchObject({ items: [] });
  });

  it('preserves watchlist and verified-purchase review behavior', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const buyer = await userService.createUser(
      { ...userPayload, email: 'review-buyer@example.com' },
      'mercadozetta',
    );
    const outsider = await userService.createUser(
      { ...userPayload, email: 'review-outsider@example.com' },
      'mercadozetta',
    );
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Reviewable product',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 3,
      image: 'reviewable.png',
      status: 'active',
    });

    const firstWatch = await watchlistService.addWatchlist(
      buyer._id,
      'mercadozetta',
      product._id,
    );
    const duplicateWatch = await watchlistService.addWatchlist(
      buyer._id,
      'mercadozetta',
      product._id,
    );
    expect(duplicateWatch._id).toBe(firstWatch._id);
    expect(firstWatch.product).toMatchObject({
      _id: product._id,
      seller: seller._id,
    });
    expect(duplicateWatch.product).toMatchObject({ _id: product._id });
    await expect(
      watchlistService.listWatchlist(buyer._id, 'mercadozetta'),
    ).resolves.toMatchObject([
      {
        user: buyer._id,
        product: { _id: product._id, seller: seller._id },
      },
    ]);
    await expect(
      watchlistService.listWatchlist(buyer._id, 'campus-market'),
    ).resolves.toEqual([]);

    await expect(
      reviewService.createReview(
        seller._id,
        'mercadozetta',
        product._id,
        5,
        'Mine',
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' });
    await expect(
      reviewService.createReview(
        outsider._id,
        'mercadozetta',
        product._id,
        5,
        'Not purchased',
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_PURCHASE_REQUIRED' });

    const now = new Date();
    const orderId = randomUUID();
    await db.insert(orders).values({
      id: orderId,
      tenantId: 'mercadozetta',
      buyerId: buyer._id,
      status: 'delivered',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(orderItems).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      orderId,
      productId: product._id,
      sellerId: seller._id,
      productName: product.name,
      quantity: 1,
      createdAt: now,
      updatedAt: now,
    });

    const created = await reviewService.createReview(
      buyer._id,
      'mercadozetta',
      product._id,
      4,
      'Good',
    );
    const updated = await reviewService.createReview(
      buyer._id,
      'mercadozetta',
      product._id,
      5,
      'Excellent',
    );
    expect(updated._id).toBe(created._id);
    expect(created).toMatchObject({
      tenantId: 'mercadozetta',
      product: product._id,
      author: buyer._id,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await expect(
      reviewService.listReviews('mercadozetta', product._id, firstPage),
    ).resolves.toMatchObject({
      items: [
        {
          _id: created._id,
          author: buyer._id,
          rating: 5,
          comment: 'Excellent',
        },
      ],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    await expect(
      reviewService.listReviews('campus-market', product._id, firstPage),
    ).resolves.toMatchObject({ items: [] });
    expect(await db.select().from(reviews)).toHaveLength(1);
    expect(
      (await db.select().from(notifications)).filter(
        ({ userId }) => userId === seller._id,
      ),
    ).toHaveLength(2);

    await watchlistService.removeWatchlist(
      buyer._id,
      'mercadozetta',
      product._id,
    );
    await expect(
      watchlistService.listWatchlist(buyer._id, 'mercadozetta'),
    ).resolves.toEqual([]);
  });
});
