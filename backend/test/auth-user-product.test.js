const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const appPath = require.resolve('../src/app');
const routesPath = require.resolve('../src/routes');
const authControllerPath = require.resolve('../src/controller/authController');
const userControllerPath = require.resolve('../src/controller/userController');
const productControllerPath = require.resolve('../src/controller/productController');
const authMiddlewarePath = require.resolve('../src/middleware/auth');
const tenantMiddlewarePath = require.resolve('../src/middleware/tenant');
const authServicePath = require.resolve('../src/services/authService');
const userServicePath = require.resolve('../src/services/userService');
const productServicePath = require.resolve('../src/services/productService');
const userModelPath = require.resolve('../src/model/user');
const productModelPath = require.resolve('../src/model/product');

let users;
let products;
let createUserError;
let findProductsError;
let createProductError;

function resetModules() {
    [
        appPath,
        routesPath,
        authControllerPath,
        userControllerPath,
        productControllerPath,
        authMiddlewarePath,
        tenantMiddlewarePath,
        authServicePath,
        userServicePath,
        productServicePath,
    ].forEach(path => {
        delete require.cache[path];
    });

    require.cache[userModelPath] = {
        id: userModelPath,
        filename: userModelPath,
        loaded: true,
        exports: {
            findOne(query) {
                const user = users.find(item => (
                    item.tenantId === query.tenantId
                    && item.email === query.email
                ));
                const foundUser = user ? { ...user } : null;

                return {
                    select: async () => foundUser,
                    then(resolve, reject) {
                        return Promise.resolve(foundUser).then(resolve, reject);
                    },
                };
            },
            async create(user) {
                if (createUserError)
                    throw createUserError;

                const newUser = { _id: `user-${users.length + 1}`, ...user };
                users.push(newUser);
                return { ...newUser };
            },
        },
    };

    require.cache[productModelPath] = {
        id: productModelPath,
        filename: productModelPath,
        loaded: true,
        exports: {
            async find(query = {}) {
                if (findProductsError)
                    throw findProductsError;

                return products.filter(product => (
                    (!query.tenantId || product.tenantId === query.tenantId)
                    && (!query.seller || product.seller === query.seller)
                ));
            },
            async create(product) {
                if (createProductError)
                    throw createProductError;

                const newProduct = { _id: `product-${products.length + 1}`, ...product };
                products.push(newProduct);
                return { ...newProduct };
            },
        },
    };
}

function loadApp() {
    resetModules();
    return require('../src/app');
}

beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    users = [{
        _id: 'user-1',
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        password: await bcrypt.hash('secret123', 4),
        username: 'seller',
        telephone: '123',
    }];
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

        const response = await request(app)
            .post('/auth/login')
            .send({
                email: 'seller@example.com',
                password: 'secret123',
            });

        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe('seller@example.com');
        expect(response.body.user.password).toBeUndefined();
        expect(response.body.token).toEqual(expect.any(String));
    });

    it('rejects login with invalid credentials', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/auth/login')
            .send({
                email: 'seller@example.com',
                password: 'wrong-password',
            });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('rejects login when credentials are missing', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'seller@example.com' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Email and password are required' });
    });

    it('rejects login for unknown users', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/auth/login')
            .send({
                email: 'missing@example.com',
                password: 'secret123',
            });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('creates users with valid payloads', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/users')
            .send({
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

        const response = await request(app)
            .post('/users')
            .send({
                email: 'buyer@example.com',
                password: 'secret123',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Email, password, username and telephone are required' });
    });

    it('rejects user creation with invalid email', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/users')
            .send({
                email: 'invalid-email',
                password: 'secret123',
                username: 'Buyer',
                telephone: '999',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Invalid email' });
    });

    it('rejects user creation when email already exists', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/users')
            .send({
                email: 'seller@example.com',
                password: 'secret123',
                username: 'Buyer',
                telephone: '999',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'User already exists' });
    });

    it('returns a friendly error when user creation violates the unique email index', async () => {
        createUserError = {
            code: 11000,
            keyPattern: { email: 1 },
        };

        const app = loadApp();

        const response = await request(app)
            .post('/users')
            .send({
                email: 'new-user@example.com',
                password: 'secret123',
                username: 'Buyer',
                telephone: '999',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'User already exists' });
    });

    it('returns a generic error when user creation fails for another reason', async () => {
        createUserError = new Error('database offline');
        const app = loadApp();

        const response = await request(app)
            .post('/users')
            .send({
                email: 'new-user@example.com',
                password: 'secret123',
                username: 'Buyer',
                telephone: '999',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Registration failed' });
    });

    it('requires authentication to create products', async () => {
        const app = loadApp();

        const response = await request(app)
            .post('/products')
            .send({
                name: 'Coffee',
                quant: '3',
                image: 'coffee.jpg',
            });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Authorization token is required' });
    });

    it('rejects product creation with invalid bearer format', async () => {
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
        expect(response.body).toEqual({ error: 'Invalid authorization format' });
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
        expect(response.body).toEqual({ error: 'Invalid authorization token' });
    });

    it('creates products for the authenticated seller', async () => {
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Coffee',
                description: 'Fresh beans',
                inventory: 3,
                image: 'coffee.jpg',
            });

        expect(response.status).toBe(201);
        expect(response.body.newProduct.seller).toBe('user-1');
        expect(response.body.newProduct.tenantId).toBe('mercadozetta');
        expect(response.body.newProduct.inventory).toBe(3);
        expect(response.body.newProduct.status).toBe('active');
        expect(response.body.newProduct.name).toBe('Coffee');
    });

    it('creates products with an explicit status', async () => {
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
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
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
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
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('X-Tenant-Id', 'campus-market')
            .set('Authorization', `Bearer ${token}`)
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
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                description: 'Fresh beans',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Name, quantity and image are required' });
    });

    it('rejects product creation with invalid inventory', async () => {
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Coffee',
                inventory: -1,
                image: 'coffee.jpg',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Quantity must be a non-negative integer' });
    });

    it('rejects product creation with invalid status', async () => {
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Coffee',
                inventory: 3,
                image: 'coffee.jpg',
                status: 'deleted',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Product status must be draft, active, paused, sold_out, or archived' });
    });

    it('returns a friendly error when product creation fails', async () => {
        createProductError = new Error('database offline');
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Coffee',
                inventory: 3,
                image: 'coffee.jpg',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Product registration failed' });
    });

    it('lists all products', async () => {
        products = [{
            _id: 'product-1',
            tenantId: 'mercadozetta',
            name: 'Coffee',
            inventory: 3,
            image: 'coffee.jpg',
            seller: 'user-1',
        }];
        const app = loadApp();

        const response = await request(app).get('/products');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(products);
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
        expect(response.body).toEqual({ error: 'Invalid tenant' });
    });

    it('returns a friendly error when product listing fails', async () => {
        findProductsError = new Error('database offline');
        const app = loadApp();

        const response = await request(app).get('/products');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Failed to list products' });
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

        const response = await request(app).get('/users/507f1f77bcf86cd799439011/products');

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
        expect(response.body).toEqual({ error: 'Invalid seller id' });
    });

    it('returns a friendly error when seller product listing fails', async () => {
        findProductsError = new Error('database offline');
        const app = loadApp();

        const response = await request(app).get('/users/507f1f77bcf86cd799439011/products');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Failed to list seller products' });
    });
});
