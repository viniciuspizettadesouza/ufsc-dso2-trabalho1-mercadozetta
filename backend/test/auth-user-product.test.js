const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const appPath = require.resolve('../src/app');
const routesPath = require.resolve('../src/routes');
const authControllerPath = require.resolve('../src/controller/authController');
const userControllerPath = require.resolve('../src/controller/userController');
const productControllerPath = require.resolve('../src/controller/productController');
const authMiddlewarePath = require.resolve('../src/middleware/auth');
const userModelPath = require.resolve('../src/model/user');
const productModelPath = require.resolve('../src/model/product');

let users;
let products;
let createUserError;

function resetModules() {
    [
        appPath,
        routesPath,
        authControllerPath,
        userControllerPath,
        productControllerPath,
        authMiddlewarePath,
    ].forEach(path => {
        delete require.cache[path];
    });

    require.cache[userModelPath] = {
        id: userModelPath,
        filename: userModelPath,
        loaded: true,
        exports: {
            findOne(query) {
                const user = users.find(item => item.email === query.email);
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
            async find() {
                return products;
            },
            async create(product) {
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
        email: 'seller@example.com',
        password: await bcrypt.hash('secret123', 4),
        username: 'seller',
        telephone: '123',
    }];
    products = [];
    createUserError = null;
});

describe('auth, user, and product routes', () => {
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
        expect(response.body.newUser.password).toBeUndefined();
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
                email: 'seller@example.com',
                password: 'secret123',
                username: 'Buyer',
                telephone: '999',
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'User already exists' });
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

    it('creates products for the authenticated seller', async () => {
        const app = loadApp();
        const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);

        const response = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Coffee',
                description: 'Fresh beans',
                quant: '3',
                image: 'coffee.jpg',
            });

        expect(response.status).toBe(201);
        expect(response.body.newProduct.seller).toBe('user-1');
        expect(response.body.newProduct.name).toBe('Coffee');
    });
});
