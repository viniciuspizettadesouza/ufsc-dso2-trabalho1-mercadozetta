const bcrypt = require('bcryptjs');
const { Types } = require('mongoose');

const authServicePath = require.resolve('../src/services/authService');
const productServicePath = require.resolve('../src/services/productService');
const userServicePath = require.resolve('../src/services/userService');
const securityPath = require.resolve('../src/config/security');
const userModelPath = require.resolve('../src/model/user');
const productModelPath = require.resolve('../src/model/product');

function clearServiceModules() {
    [
        authServicePath,
        productServicePath,
        userServicePath,
        securityPath,
        userModelPath,
        productModelPath,
    ].forEach(path => {
        delete require.cache[path];
    });
}

function installUserModelMock(mock) {
    require.cache[userModelPath] = {
        id: userModelPath,
        filename: userModelPath,
        loaded: true,
        exports: mock,
    };
}

function installProductModelMock(mock) {
    require.cache[productModelPath] = {
        id: productModelPath,
        filename: productModelPath,
        loaded: true,
        exports: mock,
    };
}

function installSecurityMock() {
    require.cache[securityPath] = {
        id: securityPath,
        filename: securityPath,
        loaded: true,
        exports: {
            getJwtSecret: () => 'unit-test-secret',
        },
    };
}

afterEach(() => {
    clearServiceModules();
    vi.restoreAllMocks();
});

describe('auth service characterization', () => {
    it('normalizes login email, signs tenant-aware tokens, and removes passwords', async () => {
        const user = {
            _id: 'user-1',
            email: 'seller@example.com',
            password: await bcrypt.hash('secret123', 4),
            username: 'seller',
            tenantId: 'mercadozetta',
            toObject() {
                return {
                    _id: this._id,
                    email: this.email,
                    password: this.password,
                    username: this.username,
                    tenantId: this.tenantId,
                };
            },
        };
        const select = vi.fn().mockResolvedValue(user);
        const findOne = vi.fn(() => ({ select }));
        installUserModelMock({ findOne });
        installSecurityMock();
        const jwt = require('jsonwebtoken');
        const signSpy = vi.spyOn(jwt, 'sign');

        const { authenticate } = require('../src/services/authService');

        const result = await authenticate({
            email: ' Seller@Example.com ',
            password: 'secret123',
        }, 'campus-market');

        expect(findOne).toHaveBeenCalledWith({ tenantId: 'campus-market', email: 'seller@example.com' });
        expect(select).toHaveBeenCalledWith('+password email username telephone tenantId');
        expect(signSpy).toHaveBeenCalledWith(
            { id: 'user-1', tenantId: 'campus-market' },
            'unit-test-secret',
            { expiresIn: '1d' }
        );
        expect(result.user.password).toBeUndefined();
        expect(result.token).toEqual(expect.any(String));
    });

    it('rejects unknown users and invalid passwords with the same public error', async () => {
        installSecurityMock();
        installUserModelMock({
            findOne: vi.fn(() => ({ select: vi.fn().mockResolvedValue(null) })),
        });
        let authService = require('../src/services/authService');

        await expect(authService.authenticate({
            email: 'missing@example.com',
            password: 'secret123',
        })).rejects.toMatchObject({
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
        });

        clearServiceModules();
        installSecurityMock();
        const hashedPassword = await bcrypt.hash('secret123', 4);
        installUserModelMock({
            findOne: vi.fn(() => ({
                select: vi.fn().mockResolvedValue({
                    _id: 'user-1',
                    email: 'seller@example.com',
                    password: hashedPassword,
                }),
            })),
        });
        authService = require('../src/services/authService');

        await expect(authService.authenticate({
            email: 'seller@example.com',
            password: 'wrong-password',
        })).rejects.toMatchObject({
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
        });
    });
});

describe('user service characterization', () => {
    it('creates normalized users per tenant and strips the password', async () => {
        const findOne = vi.fn().mockResolvedValue(null);
        const create = vi.fn().mockImplementation(async user => ({
            _id: 'user-2',
            ...user,
            toObject() {
                return { _id: this._id, ...user };
            },
        }));
        installUserModelMock({ findOne, create });

        const { createUser } = require('../src/services/userService');

        const user = await createUser({
            email: ' Buyer@Example.com ',
            password: 'secret123',
            username: ' Buyer ',
            telephone: ' 999 ',
        }, 'campus-market');

        expect(findOne).toHaveBeenCalledWith({ tenantId: 'campus-market', email: 'buyer@example.com' });
        expect(create).toHaveBeenCalledWith({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
            tenantId: 'campus-market',
        });
        expect(user).toEqual(expect.objectContaining({
            _id: 'user-2',
            email: 'buyer@example.com',
            username: 'Buyer',
            telephone: '999',
            tenantId: 'campus-market',
            password: undefined,
        }));
    });

    it('maps duplicate checks and unique-index violations to USER_EXISTS', async () => {
        installUserModelMock({
            findOne: vi.fn().mockResolvedValue({ _id: 'existing-user' }),
            create: vi.fn(),
        });
        let userService = require('../src/services/userService');

        await expect(userService.createUser({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        })).rejects.toMatchObject({ statusCode: 400, code: 'USER_EXISTS' });

        clearServiceModules();
        installUserModelMock({
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue({ code: 11000, keyPattern: { tenantId: 1, email: 1 } }),
        });
        userService = require('../src/services/userService');

        await expect(userService.createUser({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        })).rejects.toMatchObject({ statusCode: 400, code: 'USER_EXISTS' });
    });

    it('returns public seller profiles and reports missing sellers', async () => {
        const sellerId = new Types.ObjectId('507f1f77bcf86cd799439011');
        installUserModelMock({
            findOne: vi.fn()
                .mockResolvedValueOnce({
                    _id: sellerId,
                    username: 'Seller',
                    telephone: '123',
                    email: 'seller@example.com',
                })
                .mockResolvedValueOnce(null),
        });
        const { getPublicSellerProfile } = require('../src/services/userService');

        await expect(getPublicSellerProfile(String(sellerId), 'mercadozetta')).resolves.toEqual({
            _id: sellerId,
            username: 'Seller',
            telephone: '123',
            email: 'seller@example.com',
            storeName: 'Seller store',
        });

        await expect(getPublicSellerProfile('missing-user', 'mercadozetta')).rejects.toMatchObject({
            statusCode: 404,
            code: 'SELLER_NOT_FOUND',
        });
    });
});

describe('product service characterization', () => {
    it('creates products with normalized payload, seller, and tenant', async () => {
        const create = vi.fn().mockImplementation(async product => ({ _id: 'product-1', ...product }));
        installProductModelMock({ create, find: vi.fn(), findOne: vi.fn() });
        installUserModelMock({ findOne: vi.fn() });

        const { createProduct } = require('../src/services/productService');

        const product = await createProduct({
            name: ' Bike ',
            description: ' Fast ',
            category: ' Sports ',
            subcategory: ' Bikes ',
            inventory: '2',
            image: ' bike.png ',
        }, 'seller-1', 'campus-market');

        expect(create).toHaveBeenCalledWith({
            name: 'Bike',
            description: 'Fast',
            category: 'sports',
            subcategory: 'bikes',
            inventory: 2,
            image: 'bike.png',
            status: 'active',
            tenantId: 'campus-market',
            seller: 'seller-1',
        });
        expect(product._id).toBe('product-1');
    });

    it('lists products with tenant scoping, filtering, and sorting', async () => {
        const products = [
            {
                _id: 'product-1',
                name: 'Coffee',
                description: 'Fresh beans',
                category: 'drinks',
                subcategory: 'coffee',
                status: 'active',
                inventory: 3,
                seller: 'seller-1',
                createdAt: '2024-01-01T00:00:00.000Z',
            },
            {
                _id: 'product-2',
                name: 'Tea',
                description: 'Green leaves',
                category: 'drinks',
                subcategory: 'tea',
                status: 'sold_out',
                inventory: 0,
                seller: 'seller-2',
                createdAt: '2024-01-02T00:00:00.000Z',
            },
        ];
        const find = vi.fn().mockResolvedValue(products);
        installProductModelMock({ find, findOne: vi.fn(), create: vi.fn() });
        installUserModelMock({ findOne: vi.fn() });

        const { listProducts, listProductsBySeller } = require('../src/services/productService');

        await expect(listProducts('mercadozetta', {
            q: 'green',
            availability: 'sold_out',
            status: 'sold_out',
            sort: 'created_asc',
        })).resolves.toEqual([products[1]]);
        expect(find).toHaveBeenCalledWith({ tenantId: 'mercadozetta' });

        await expect(listProductsBySeller('507f1f77bcf86cd799439011', 'campus-market', {
            category: 'drinks',
            sort: 'inventory_desc',
        })).resolves.toEqual(products);
        expect(find).toHaveBeenLastCalledWith({
            tenantId: 'campus-market',
            seller: '507f1f77bcf86cd799439011',
        });
    });

    it('loads products by id, enriches seller details, and tolerates seller lookup failures', async () => {
        const product = {
            _id: 'product-1',
            name: 'Coffee',
            seller: '507f1f77bcf86cd799439011',
            toObject() {
                return {
                    _id: this._id,
                    name: this.name,
                    seller: this.seller,
                };
            },
        };
        installProductModelMock({
            find: vi.fn(),
            create: vi.fn(),
            findOne: vi.fn()
                .mockResolvedValueOnce(product)
                .mockResolvedValueOnce(product)
                .mockResolvedValueOnce(null),
        });
        installUserModelMock({
            findOne: vi.fn()
                .mockResolvedValueOnce({ _id: product.seller, username: 'Seller', telephone: '123', email: 'seller@example.com' })
                .mockRejectedValueOnce(new Error('seller lookup failed')),
        });

        const { getProductById } = require('../src/services/productService');

        await expect(getProductById('product-1', 'mercadozetta')).resolves.toMatchObject({
            _id: 'product-1',
            sellerProfile: {
                _id: product.seller,
                username: 'Seller',
                telephone: '123',
                email: 'seller@example.com',
                storeName: 'Seller store',
            },
        });
        await expect(getProductById('product-1', 'mercadozetta')).resolves.toMatchObject({
            _id: 'product-1',
            name: 'Coffee',
            seller: '507f1f77bcf86cd799439011',
        });
        await expect(getProductById('missing', 'mercadozetta')).resolves.toBeNull();
    });

    it('rejects invalid seller ids before querying seller product lists', async () => {
        const find = vi.fn();
        installProductModelMock({ find, findOne: vi.fn(), create: vi.fn() });
        installUserModelMock({ findOne: vi.fn() });

        const { listProductsBySeller } = require('../src/services/productService');

        await expect(listProductsBySeller('not-an-object-id')).rejects.toMatchObject({
            statusCode: 400,
            code: 'INVALID_SELLER_ID',
        });
        expect(find).not.toHaveBeenCalled();
    });
});
