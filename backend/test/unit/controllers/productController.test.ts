import { afterEach, describe, expect, it, vi } from 'vitest';
import controller from '../../../src/controller/productController';
import ProductService from '../../../src/services/productService';

function createResponse() {
    return {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
    };
}

function loadController(service: any = {}) {
    if (service.listProducts)
        vi.spyOn(ProductService, 'listProducts').mockImplementation(service.listProducts);
    if (service.getProductById)
        vi.spyOn(ProductService, 'getProductById').mockImplementation(service.getProductById);
    if (service.createProduct)
        vi.spyOn(ProductService, 'createProduct').mockImplementation(service.createProduct);
    if (service.listProductsBySeller)
        vi.spyOn(ProductService, 'listProductsBySeller').mockImplementation(service.listProductsBySeller);
    return controller;
}

afterEach(() => {
    vi.restoreAllMocks();
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

        await controller.index(req as any, res as any);

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

        await controller.detail(req as any, res as any);

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
        } as any, createResponse() as any)).rejects.toMatchObject({
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

        await controller.add(req as any, res as any);

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

        await controller.listBySeller(req as any, res as any);

        expect(listProductsBySeller).toHaveBeenCalledWith('user-1', 'mercadozetta', req.validated.query);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(products);
    });
});
