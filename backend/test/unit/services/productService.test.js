const { clearModules, mockModule } = require('../helpers/moduleMock');

const servicePath = require.resolve('../../../src/services/productService');
const productModelPath = require.resolve('../../../src/model/product');
const userServicePath = require.resolve('../../../src/services/userService');

function loadProductService(productModel, userService = {}) {
    clearModules(servicePath, productModelPath, userServicePath);
    mockModule(productModelPath, productModel);
    mockModule(userServicePath, {
        getPublicSellerProfile: userService.getPublicSellerProfile || vi.fn(),
    });
    return require('../../../src/services/productService');
}

afterEach(() => {
    clearModules(servicePath, productModelPath, userServicePath);
});

describe('productService', () => {
    const products = [
        {
            _id: 'product-1',
            name: 'Mouse',
            description: 'Wireless mouse',
            category: 'peripherals',
            subcategory: 'mice',
            seller: 'seller-1',
            status: 'active',
            inventory: 5,
            createdAt: '2024-01-02T00:00:00.000Z',
        },
        {
            _id: 'product-2',
            name: 'Keyboard',
            description: 'Mechanical keyboard',
            category: 'peripherals',
            subcategory: 'keyboards',
            seller: 'seller-2',
            status: 'sold_out',
            inventory: 0,
            createdAt: '2024-01-03T00:00:00.000Z',
        },
        {
            _id: 'product-3',
            name: 'Desk',
            description: 'Standing desk',
            category: 'furniture',
            subcategory: 'desks',
            seller: 'seller-1',
            status: 'paused',
            inventory: 2,
            createdAt: '2024-01-01T00:00:00.000Z',
        },
    ];

    it('lists products for a tenant with text, category, availability, and sort filters', async () => {
        const find = vi.fn().mockResolvedValue(products);
        const { listProducts } = loadProductService({ find });

        const result = await listProducts('campus-market', {
            q: 'keyboard',
            category: 'peripherals',
            availability: 'sold_out',
            sort: 'name_asc',
        });

        expect(find).toHaveBeenCalledWith({ tenantId: 'campus-market' });
        expect(result.map(product => product._id)).toEqual(['product-2']);
    });

    it('sorts products by creation, name, and inventory', async () => {
        const find = vi.fn().mockResolvedValue(products);
        const { listProducts } = loadProductService({ find });

        await expect(listProducts('mercadozetta', { sort: 'created_asc' }))
            .resolves.toMatchObject([{ _id: 'product-3' }, { _id: 'product-1' }, { _id: 'product-2' }]);
        await expect(listProducts('mercadozetta', { sort: 'name_asc' }))
            .resolves.toMatchObject([{ _id: 'product-3' }, { _id: 'product-2' }, { _id: 'product-1' }]);
        await expect(listProducts('mercadozetta', { sort: 'inventory_desc' }))
            .resolves.toMatchObject([{ _id: 'product-1' }, { _id: 'product-3' }, { _id: 'product-2' }]);
    });

    it('creates products with validated payload, seller id, and tenant id', async () => {
        const create = vi.fn().mockResolvedValue({ _id: 'product-1' });
        const { createProduct } = loadProductService({ create });

        await expect(createProduct({
            name: ' Keyboard ',
            inventory: '2',
            image: 'keyboard.png',
        }, 'seller-1', 'campus-market')).resolves.toEqual({ _id: 'product-1' });

        expect(create).toHaveBeenCalledWith({
            name: 'Keyboard',
            description: '',
            category: 'general',
            subcategory: '',
            inventory: 2,
            image: 'keyboard.png',
            status: 'active',
            seller: 'seller-1',
            tenantId: 'campus-market',
        });
    });

    it('returns product detail with seller profile when available', async () => {
        const product = {
            _id: 'product-1',
            seller: '507f1f77bcf86cd799439011',
            toObject() {
                return {
                    _id: this._id,
                    seller: this.seller,
                };
            },
        };
        const findOne = vi.fn().mockResolvedValue(product);
        const getPublicSellerProfile = vi.fn().mockResolvedValue({ _id: product.seller, username: 'Seller' });
        const { getProductById } = loadProductService({ findOne }, { getPublicSellerProfile });

        await expect(getProductById(' product-1 ', 'mercadozetta')).resolves.toEqual({
            _id: product._id,
            seller: product.seller,
            sellerProfile: { _id: product.seller, username: 'Seller' },
        });
        expect(findOne).toHaveBeenCalledWith({ _id: 'product-1', tenantId: 'mercadozetta' });
        expect(getPublicSellerProfile).toHaveBeenCalledWith(product.seller, 'mercadozetta');
    });

    it('returns null for missing products and falls back when seller profile lookup fails', async () => {
        let { getProductById } = loadProductService({
            findOne: vi.fn().mockResolvedValue(null),
        });

        await expect(getProductById('missing', 'mercadozetta')).resolves.toBeNull();

        const product = { _id: 'product-1', seller: '507f1f77bcf86cd799439011' };
        ({ getProductById } = loadProductService({
            findOne: vi.fn().mockResolvedValue(product),
        }, {
            getPublicSellerProfile: vi.fn().mockRejectedValue(new Error('seller missing')),
        }));

        await expect(getProductById('product-1', 'mercadozetta')).resolves.toBe(product);
    });

    it('lists products by seller with seller validation and filters', async () => {
        const find = vi.fn().mockResolvedValue(products);
        const { listProductsBySeller } = loadProductService({ find });
        const sellerId = '507f1f77bcf86cd799439011';

        const result = await listProductsBySeller(sellerId, 'campus-market', {
            seller: 'seller-1',
            status: 'active',
        });

        expect(find).toHaveBeenCalledWith({ tenantId: 'campus-market', seller: sellerId });
        expect(result.map(product => product._id)).toEqual(['product-1']);
    });
});
