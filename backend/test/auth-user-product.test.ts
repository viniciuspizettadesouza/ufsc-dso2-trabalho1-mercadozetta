import { beforeEach, describe, expect, it } from 'vitest';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const appPath = require.resolve('@/app');
const routesPath = require.resolve('@/routes');
const authControllerPath = require.resolve('@/controller/authController');
const userControllerPath = require.resolve('@/controller/userController');
const productControllerPath = require.resolve('@/controller/productController');
const asyncHandlerPath = require.resolve('@/middleware/asyncHandler');
const authMiddlewarePath = require.resolve('@/middleware/auth');
const csrfMiddlewarePath = require.resolve('@/middleware/csrf');
const errorHandlerPath = require.resolve('@/middleware/errorHandler');
const rateLimitPath = require.resolve('@/middleware/rateLimit');
const requestContextPath = require.resolve('@/middleware/requestContext');
const tenantMiddlewarePath = require.resolve('@/middleware/tenant');
const validateRequestPath = require.resolve('@/middleware/validateRequest');
const securityConfigPath = require.resolve('@/config/security');
const authServicePath = require.resolve('@/services/authService');
const sessionServicePath = require.resolve('@/services/sessionService');
const userServicePath = require.resolve('@/services/userService');
const productServicePath = require.resolve('@/services/productService');
const userModelPath = require.resolve('@/model/user');
const productModelPath = require.resolve('@/model/product');
const sessionModelPath = require.resolve('@/model/session');
const sessionId = '507f1f77bcf86cd799439011';

type MockDocument = {
  _id?: string;
  tenantId?: string;
  seller?: string;
  email?: string;
  [key: string]:
    string | number | boolean | null | undefined | (() => MockDocument);
};

type MockQuery = {
  tenantId?: string;
  seller?: string;
  email?: string;
  _id?: string;
  tokenVersion?: number;
  $or?: Array<{ tokenVersion: number | { $exists: boolean } }>;
};

let users: MockDocument[];
let products: MockDocument[];
let createUserError:
  Error | { code?: number; keyPattern?: Record<string, number> } | null;
let findProductsError: Error | null;
let createProductError: Error | null;

function createDocument<T extends MockDocument>(
  item: T,
): T & { toObject(): T } {
  return {
    ...item,
    toObject() {
      return { ...item };
    },
  } as T & { toObject(): T };
}

function resetModules() {
  [
    appPath,
    routesPath,
    authControllerPath,
    userControllerPath,
    productControllerPath,
    asyncHandlerPath,
    authMiddlewarePath,
    csrfMiddlewarePath,
    errorHandlerPath,
    rateLimitPath,
    requestContextPath,
    tenantMiddlewarePath,
    validateRequestPath,
    securityConfigPath,
    authServicePath,
    sessionServicePath,
    userServicePath,
    productServicePath,
  ].forEach((path) => {
    delete require.cache[path];
  });

  const moduleCache = require.cache as Record<string, NodeModule>;

  moduleCache[csrfMiddlewarePath] = {
    id: csrfMiddlewarePath,
    filename: csrfMiddlewarePath,
    loaded: true,
    exports: {
      requireCsrf: (_req: unknown, _res: unknown, next: () => void) => next(),
      requireAllowedOrigin: (_req: unknown, _res: unknown, next: () => void) =>
        next(),
      validatePresentOrigin: (_req: unknown, _res: unknown, next: () => void) =>
        next(),
    },
  } as NodeModule;

  moduleCache[sessionModelPath] = {
    id: sessionModelPath,
    filename: sessionModelPath,
    loaded: true,
    exports: { exists: async () => ({ _id: sessionId }) },
  } as NodeModule;

  moduleCache[sessionServicePath] = {
    id: sessionServicePath,
    filename: sessionServicePath,
    loaded: true,
    exports: {
      accessTokenContract: {
        issuer: 'mercadozetta',
        audience: 'mercadozetta-api',
      },
      async createSession() {
        return {
          accessToken: 'cookie-access-token',
          refreshToken: 'refresh-token',
          csrfToken: 'csrf-token',
          session: {
            id: '507f1f77bcf86cd799439011',
            expiresAt: new Date(Date.now() + 60_000),
          },
        };
      },
      async revokeAllSessions() {},
    },
  } as NodeModule;

  moduleCache[userModelPath] = {
    id: userModelPath,
    filename: userModelPath,
    loaded: true,
    exports: {
      findOne(query: MockQuery) {
        const user = users.find(
          (item: MockDocument) =>
            item.tenantId === query.tenantId &&
            (!query.email || item.email === query.email) &&
            (!query._id || item._id === query._id) &&
            (query.tokenVersion === undefined ||
              item.tokenVersion === query.tokenVersion),
        );
        const foundUser = user ? createDocument(user) : null;

        return {
          select: async () => foundUser,
          then(
            resolve: (value: MockDocument | null) => void,
            reject: (reason?: Error) => void,
          ) {
            return Promise.resolve(foundUser).then(resolve, reject);
          },
        };
      },
      async exists(query: MockQuery) {
        return (
          users.find(
            (item: MockDocument) =>
              item.tenantId === query.tenantId &&
              item._id === query._id &&
              (query.tokenVersion === undefined ||
                item.tokenVersion === query.tokenVersion) &&
              (!query.$or ||
                item.tokenVersion === 0 ||
                item.tokenVersion === undefined),
          ) || null
        );
      },
      async updateOne(
        query: MockQuery,
        update: { $inc?: { tokenVersion?: number } },
      ) {
        const user = users.find(
          (item: MockDocument) =>
            item.tenantId === query.tenantId && item._id === query._id,
        );

        if (!user) return { matchedCount: 0 };

        user.tokenVersion =
          Number(user.tokenVersion || 0) +
          Number(update.$inc?.tokenVersion || 0);
        return { matchedCount: 1 };
      },
      async create(user: MockDocument) {
        if (createUserError) throw createUserError;

        const newUser = createDocument({
          _id: `user-${users.length + 1}`,
          ...user,
        });
        users.push(newUser);
        return { ...newUser };
      },
    },
  } as NodeModule;

  moduleCache[productModelPath] = {
    id: productModelPath,
    filename: productModelPath,
    loaded: true,
    exports: {
      async find(query: MockQuery = {}) {
        if (findProductsError) throw findProductsError;

        return products
          .filter(
            (product: MockDocument) =>
              (!query.tenantId || product.tenantId === query.tenantId) &&
              (!query.seller || product.seller === query.seller),
          )
          .map(createDocument);
      },
      async findOne(query: MockQuery = {}) {
        if (findProductsError) throw findProductsError;

        const product = products.find(
          (item: MockDocument) =>
            (!query.tenantId || item.tenantId === query.tenantId) &&
            (!query._id || item._id === query._id),
        );

        return product ? createDocument(product) : null;
      },
      async create(product: MockDocument) {
        if (createProductError) throw createProductError;

        const newProduct = createDocument({
          _id: `product-${products.length + 1}`,
          ...product,
        });
        products.push(newProduct);
        return { ...newProduct };
      },
    },
  } as NodeModule;
}

function loadApp() {
  resetModules();
  return require('@/app');
}

function accessCookie(tenantId = 'mercadozetta') {
  const token = jwt.sign(
    { tenantId, sid: sessionId, tokenVersion: 0, typ: 'access' },
    'test-secret',
    {
      keyid: 'current',
      subject: 'user-1',
      issuer: 'mercadozetta',
      audience: 'mercadozetta-api',
    },
  );
  return `mz_at=${token}`;
}

beforeEach(async () => {
  process.env.JWT_SIGNING_KEYS = '{"current":"test-secret"}';
  process.env.JWT_ACTIVE_KID = 'current';
  users = [
    {
      _id: 'user-1',
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
      password: await bcrypt.hash('secret123', 4),
      username: 'seller',
      telephone: '123',
      tokenVersion: 0,
    },
  ];
  products = [];
  createUserError = null;
  findProductsError = null;
  createProductError = null;
});

describe('auth, user, and product routes', () => {
  it('returns the root welcome response', async () => {
    const app = loadApp();

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Welcome to zetta2k app' });
  });

  it('logs in with valid credentials', async () => {
    const app = loadApp();

    const response = await request(app).post('/auth/login').send({
      email: 'seller@example.com',
      password: 'secret123',
    });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('seller@example.com');
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.tokenVersion).toBeUndefined();
    expect(response.body.token).toBeUndefined();
  });

  it('revokes the current token on logout', async () => {
    const app = loadApp();
    const logout = await request(app)
      .post('/auth/logout')
      .set('Cookie', accessCookie());

    const reuse = await request(app)
      .post('/products')
      .set('Cookie', accessCookie())
      .send({ name: 'Coffee', inventory: 1, image: 'coffee.jpg' });

    expect(logout.status).toBe(204);
    expect(reuse.status).toBe(401);
    expect(reuse.body).toMatchObject({ error: 'Invalid authorization token' });
  });

  it('rejects login with invalid credentials', async () => {
    const app = loadApp();

    const response = await request(app).post('/auth/login').send({
      email: 'seller@example.com',
      password: 'wrong-password',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'Invalid credentials' });
  });

  it('rejects login when credentials are missing', async () => {
    const app = loadApp();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'seller@example.com' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Email and password are required',
    });
  });

  it('rejects login for unknown users', async () => {
    const app = loadApp();

    const response = await request(app).post('/auth/login').send({
      email: 'missing@example.com',
      password: 'secret123',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'Invalid credentials' });
  });

  it('creates users with valid payloads', async () => {
    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'Buyer@Example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });

    expect(response.status).toBe(201);
    expect(response.body.newUser.email).toBe('buyer@example.com');
    expect(response.body.newUser.tenantId).toBe('mercadozetta');
    expect(response.body.newUser.password).toBeUndefined();
  });

  it('allows the same email in different tenants', async () => {
    const app = loadApp();

    const response = await request(app)
      .post('/users')
      .set('X-Tenant-Id', 'campus-market')
      .send({
        email: 'seller@example.com',
        password: 'secret123',
        username: 'Campus Seller',
        telephone: '999',
      });

    expect(response.status).toBe(201);
    expect(response.body.newUser.email).toBe('seller@example.com');
    expect(response.body.newUser.tenantId).toBe('campus-market');
  });

  it('rejects user creation when required fields are missing', async () => {
    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'buyer@example.com',
      password: 'secret123',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Email, password, username and telephone are required',
    });
  });

  it('rejects user creation with invalid email', async () => {
    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'invalid-email',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Invalid email' });
  });

  it('rejects user creation with weak passwords', async () => {
    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'buyer@example.com',
      password: 'short',
      username: 'Buyer',
      telephone: '999',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Password must be at least 8 characters long',
    });
  });

  it('rejects user creation when email already exists', async () => {
    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'seller@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'User already exists' });
  });

  it('returns a friendly error when user creation violates the unique email index', async () => {
    createUserError = {
      code: 11000,
      keyPattern: { email: 1 },
    };

    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'new-user@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'User already exists' });
  });

  it('returns a generic error when user creation fails for another reason', async () => {
    createUserError = new Error('database offline');
    const app = loadApp();

    const response = await request(app).post('/users').send({
      email: 'new-user@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: 'Internal server error' });
  });

  it('requires authentication to create products', async () => {
    const app = loadApp();

    const response = await request(app).post('/products').send({
      name: 'Coffee',
      quant: '3',
      image: 'coffee.jpg',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'Authorization token is required',
    });
  });

  it('does not accept an Authorization header as authentication', async () => {
    const app = loadApp();

    const response = await request(app)
      .post('/products')
      .set('Authorization', 'Token abc')
      .send({
        name: 'Coffee',
        quant: '3',
        image: 'coffee.jpg',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'Authorization token is required',
    });
  });

  it('rejects product creation with invalid token', async () => {
    const app = loadApp();

    const response = await request(app)
      .post('/products')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        name: 'Coffee',
        quant: '3',
        image: 'coffee.jpg',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'Authorization token is required',
    });
  });

  it('creates products for the authenticated seller', async () => {
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        name: 'Coffee',
        description: 'Fresh beans',
        category: 'drinks',
        subcategory: 'coffee',
        inventory: 3,
        image: 'coffee.jpg',
      });

    expect(response.status).toBe(201);
    expect(response.body.newProduct.seller).toBe('user-1');
    expect(response.body.newProduct.tenantId).toBe('mercadozetta');
    expect(response.body.newProduct.inventory).toBe(3);
    expect(response.body.newProduct.status).toBe('active');
    expect(response.body.newProduct.category).toBe('drinks');
    expect(response.body.newProduct.subcategory).toBe('coffee');
    expect(response.body.newProduct.name).toBe('Coffee');
  });

  it('creates products with an explicit status', async () => {
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        status: 'draft',
      });

    expect(response.status).toBe(201);
    expect(response.body.newProduct.status).toBe('draft');
  });

  it('normalizes legacy quant payloads into numeric inventory', async () => {
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        name: 'Coffee',
        quant: '3',
        image: 'coffee.jpg',
      });

    expect(response.status).toBe(201);
    expect(response.body.newProduct.inventory).toBe(3);
    expect(response.body.newProduct.quant).toBeUndefined();
  });

  it('creates products for the active tenant', async () => {
    users.push({
      _id: 'user-1',
      tenantId: 'campus-market',
      email: 'seller@campus.example.com',
      tokenVersion: 0,
    });
    const app = loadApp();
    const cookie = accessCookie('campus-market');

    const response = await request(app)
      .post('/products')
      .set('X-Tenant-Id', 'campus-market')
      .set('Cookie', cookie)
      .send({
        name: 'Notebook',
        inventory: 1,
        image: 'notebook.jpg',
      });

    expect(response.status).toBe(201);
    expect(response.body.newProduct.tenantId).toBe('campus-market');
  });

  it('rejects product creation with missing required fields', async () => {
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        description: 'Fresh beans',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Name, quantity and image are required',
    });
  });

  it('rejects product creation with invalid inventory', async () => {
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        name: 'Coffee',
        inventory: -1,
        image: 'coffee.jpg',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Quantity must be a non-negative integer',
    });
  });

  it('rejects product creation with invalid status', async () => {
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        status: 'deleted',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error:
        'Product status must be draft, active, paused, sold_out, or archived',
    });
  });

  it('returns a friendly error when product creation fails', async () => {
    createProductError = new Error('database offline');
    const app = loadApp();
    const cookie = accessCookie();

    const response = await request(app)
      .post('/products')
      .set('Cookie', cookie)
      .send({
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
      });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: 'Internal server error' });
  });

  it('lists all products', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        seller: 'user-1',
      },
    ];
    const app = loadApp();

    const response = await request(app).get('/products');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(products);
  });

  it('filters and sorts products from query params', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        description: 'Fresh beans',
        category: 'drinks',
        inventory: 3,
        image: 'coffee.jpg',
        seller: 'user-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        _id: 'product-2',
        tenantId: 'mercadozetta',
        name: 'Tea',
        description: 'Green leaves',
        category: 'drinks',
        inventory: 0,
        image: 'tea.jpg',
        seller: 'user-1',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    ];
    const app = loadApp();

    const response = await request(app).get('/products').query({
      q: 'tea',
      category: 'drinks',
      availability: 'sold_out',
      sort: 'name_asc',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([products[1]]);
  });

  it('rejects unsupported product sort query params', async () => {
    const app = loadApp();

    const response = await request(app)
      .get('/products')
      .query({ sort: 'price_desc' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error:
        'Product sort must be created_asc, created_desc, name_asc, or inventory_desc',
      code: 'INVALID_PRODUCT_SORT',
    });
  });

  it('supports alternative filters and sort modes', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        description: 'Fresh beans',
        category: 'drinks',
        subcategory: 'beans',
        status: 'active',
        inventory: 3,
        image: 'coffee.jpg',
        seller: 'user-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        _id: 'product-2',
        tenantId: 'mercadozetta',
        name: 'Notebook',
        description: 'Paper',
        category: 'school',
        subcategory: 'paper',
        status: 'paused',
        inventory: 8,
        image: 'notebook.jpg',
        seller: 'user-2',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    ];
    const app = loadApp();

    const inStockResponse = await request(app).get('/products').query({
      availability: 'in_stock',
      seller: 'user-1',
      status: 'active',
      subcategory: 'beans',
      sort: 'created_asc',
    });
    const inventoryResponse = await request(app)
      .get('/products')
      .query({ availability: 'in_stock', sort: 'inventory_desc' });

    expect(inStockResponse.status).toBe(200);
    expect(inStockResponse.body).toEqual([products[0]]);
    expect(inventoryResponse.status).toBe(200);
    expect(
      inventoryResponse.body.map((product: { _id: string }) => product._id),
    ).toEqual(['product-2', 'product-1']);
  });

  it('supports search aliases and missing optional product fields', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        inventory: 0,
        image: 'coffee.jpg',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
      {
        _id: 'product-2',
        tenantId: 'mercadozetta',
        name: 'Notebook',
        description: 'Paper',
        inventory: 1,
        image: 'notebook.jpg',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    const app = loadApp();

    const response = await request(app)
      .get('/products')
      .query({ search: 'paper', sort: 'created_asc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([products[1]]);
  });

  it('loads product details with seller information', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        description: 'Fresh beans',
        category: 'drinks',
        inventory: 3,
        image: 'coffee.jpg',
        seller: 'user-1',
      },
    ];
    const app = loadApp();

    const response = await request(app).get('/products/product-1');

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Coffee');
    expect(response.body.sellerProfile).toEqual(
      expect.objectContaining({
        _id: 'user-1',
        email: 'seller@example.com',
        storeName: 'seller store',
      }),
    );
  });

  it('loads product details when seller enrichment is unavailable', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        seller: 'missing-user',
      },
    ];
    const app = loadApp();

    const response = await request(app).get('/products/product-1');

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Coffee');
    expect(response.body.sellerProfile).toBeUndefined();
  });

  it('returns not found for missing product details', async () => {
    const app = loadApp();

    const response = await request(app).get('/products/missing-product');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'Product not found' });
  });

  it('returns a friendly error when product detail loading fails', async () => {
    findProductsError = new Error('database offline');
    const app = loadApp();

    const response = await request(app).get('/products/product-1');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: 'Internal server error' });
  });

  it('loads public seller profiles', async () => {
    const app = loadApp();

    const response = await request(app).get('/users/user-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        _id: 'user-1',
        username: 'seller',
        telephone: '123',
      }),
    );
  });

  it('uses fallback store branding for unnamed sellers', async () => {
    users[0].username = '';
    const app = loadApp();

    const response = await request(app).get('/users/user-1');

    expect(response.status).toBe(200);
    expect(response.body.storeName).toBe('Seller store');
  });

  it('returns not found for missing seller profiles', async () => {
    const app = loadApp();

    const response = await request(app).get('/users/missing-user');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'Seller not found' });
  });

  it('lists only products for the active tenant', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        seller: 'user-1',
      },
      {
        _id: 'product-2',
        tenantId: 'campus-market',
        name: 'Notebook',
        inventory: 1,
        image: 'notebook.jpg',
        seller: 'user-2',
      },
    ];
    const app = loadApp();

    const response = await request(app)
      .get('/products')
      .set('X-Tenant-Id', 'campus-market');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([products[1]]);
  });

  it('rejects unknown tenants', async () => {
    const app = loadApp();

    const response = await request(app)
      .get('/products')
      .set('X-Tenant-Id', 'missing-tenant');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Invalid tenant' });
  });

  it('returns a friendly error when product listing fails', async () => {
    findProductsError = new Error('database offline');
    const app = loadApp();

    const response = await request(app).get('/products');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: 'Internal server error' });
  });

  it('lists products by seller', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        seller: '507f1f77bcf86cd799439011',
      },
      {
        _id: 'product-2',
        tenantId: 'campus-market',
        name: 'Tea',
        inventory: 2,
        image: 'tea.jpg',
        seller: '507f1f77bcf86cd799439012',
      },
    ];
    const app = loadApp();

    const response = await request(app).get(
      '/users/507f1f77bcf86cd799439011/products',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([products[0]]);
  });

  it('keeps seller listings tenant-scoped', async () => {
    products = [
      {
        _id: 'product-1',
        tenantId: 'mercadozetta',
        name: 'Coffee',
        inventory: 3,
        image: 'coffee.jpg',
        seller: '507f1f77bcf86cd799439011',
      },
      {
        _id: 'product-2',
        tenantId: 'campus-market',
        name: 'Tea',
        inventory: 2,
        image: 'tea.jpg',
        seller: '507f1f77bcf86cd799439011',
      },
    ];
    const app = loadApp();

    const response = await request(app)
      .get('/users/507f1f77bcf86cd799439011/products')
      .set('X-Tenant-Id', 'campus-market');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([products[1]]);
  });

  it('rejects seller product listing with invalid seller id', async () => {
    const app = loadApp();

    const response = await request(app).get('/users/not-an-id/products');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Invalid seller id' });
  });

  it('returns a friendly error when seller product listing fails', async () => {
    findProductsError = new Error('database offline');
    const app = loadApp();

    const response = await request(app).get(
      '/users/507f1f77bcf86cd799439011/products',
    );

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: 'Internal server error' });
  });
});
