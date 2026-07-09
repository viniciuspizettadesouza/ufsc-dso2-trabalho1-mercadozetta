const { clearModules, mockModule } = require('../helpers/moduleMock');

const controllerPath = require.resolve('../../../src/controller/productController');
const servicePath = require.resolve('../../../src/services/productService');

function createResponse() {
    return {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
    };
}

function loadController(service = {}) {
    clearModules(controllerPath, servicePath);
    mockModule(servicePath, {
        listProducts: service.listProducts || vi.fn(),
        getProductById: service.getProductById || vi.fn(),
        createProduct: service.createProduct || vi.fn(),
        listProductsBySeller: service.listProductsBySeller || vi.fn(),
    });
    return require('../../../src/controller/productController');
}

afterEach(() => {
    clearModules(controllerPath, servicePath);
});

describe('productController', () => {
    it('lists products for the current tenant and validated query', async () => {
        const products = [{ _id: 'product-1' }];
        const listProducts = vi.fn().mockResolvedValue(products);
        const controller = loadController({ listProducts });
        const req = {
            tenant: { id: 'mercadozetta' },
            validated: { query: { sort: 'name_asc' } },
        };
        const res = createResponse();

        await controller.index(req, res);

        expect(listProducts).toHaveBeenCalledWith('mercadozetta', req.validated.query);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(products);
    });

    it('returns a product detail when found', async () => {
        const product = { _id: 'product-1' };
        const getProductById = vi.fn().mockResolvedValue(product);
        const controller = loadController({ getProductById });
        const req = {
            tenant: { id: 'campus-market' },
            validated: { params: { productId: 'product-1' } },
        };
        const res = createResponse();

        await controller.detail(req, res);

        expect(getProductById).toHaveBeenCalledWith('product-1', 'campus-market');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(product);
    });

    it('throws PRODUCT_NOT_FOUND when detail lookup returns null', async () => {
        const getProductById = vi.fn().mockResolvedValue(null);
        const controller = loadController({ getProductById });

        await expect(controller.detail({
            tenant: { id: 'mercadozetta' },
            validated: { params: { productId: 'missing' } },
        }, createResponse())).rejects.toMatchObject({
            statusCode: 404,
            code: 'PRODUCT_NOT_FOUND',
        });
    });

    it('creates products for the authenticated user and tenant', async () => {
        const newProduct = { _id: 'product-1' };
        const createProduct = vi.fn().mockResolvedValue(newProduct);
        const controller = loadController({ createProduct });
        const req = {
            userId: 'user-1',
            tenant: { id: 'mercadozetta' },
            validated: { body: { name: 'Keyboard' } },
        };
        const res = createResponse();

        await controller.add(req, res);

        expect(createProduct).toHaveBeenCalledWith(req.validated.body, 'user-1', 'mercadozetta');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.send).toHaveBeenCalledWith({ newProduct });
    });

    it('lists products by seller with validated params and query', async () => {
        const products = [{ _id: 'product-1' }];
        const listProductsBySeller = vi.fn().mockResolvedValue(products);
        const controller = loadController({ listProductsBySeller });
        const req = {
            tenant: { id: 'mercadozetta' },
            validated: {
                params: { userId: 'user-1' },
                query: { availability: 'in_stock' },
            },
        };
        const res = createResponse();

        await controller.listBySeller(req, res);

        expect(listProductsBySeller).toHaveBeenCalledWith('user-1', 'mercadozetta', req.validated.query);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(products);
    });
});
