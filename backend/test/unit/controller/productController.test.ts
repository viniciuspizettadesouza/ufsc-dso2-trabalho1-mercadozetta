import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createProductController } from '@/controller/productController';
import type { ProductService } from '@/services/productService';

const product = {
  _id: '507f191e-810c-4197-9de8-60ea00000001',
  tenantId: 'mercadozetta',
  seller: '507f1f77-bcf8-4ecd-8994-390110000001',
  name: 'Keyboard',
  description: 'Compact keyboard',
  category: 'electronics',
  subcategory: 'keyboards',
  inventory: 2,
  image: 'keyboard.png',
  status: 'active' as const,
  createdAt: new Date('2026-01-15T12:00:00.000Z'),
  updatedAt: new Date('2026-01-15T12:00:00.000Z'),
};

function responseDouble() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.send = vi.fn().mockReturnValue(response);
  return response;
}

describe('productController', () => {
  it('returns the created product using the shared mutation response shape', async () => {
    const productService = {
      createProduct: vi.fn().mockResolvedValue(product),
    } as unknown as ProductService;
    const controller = createProductController(productService);
    const body = {
      name: 'Keyboard',
      description: 'Compact keyboard',
      category: 'electronics',
      subcategory: 'keyboards',
      inventory: 2,
      image: 'keyboard.png',
      status: 'active' as const,
    };
    const request = {
      validated: { body },
      userId: product.seller,
      tenant: { id: product.tenantId },
    } as unknown as Request;
    const response = responseDouble();

    await controller.add(request as never, response);

    expect(productService.createProduct).toHaveBeenCalledWith(
      body,
      product.seller,
      product.tenantId,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.send).toHaveBeenCalledWith(product);
    expect(response.send).not.toHaveBeenCalledWith({ newProduct: product });
  });

  it('lists catalog and seller products with validated filters', async () => {
    const result = {
      items: [product],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    };
    const productService = {
      listProducts: vi.fn().mockResolvedValue(result),
      listProductsBySeller: vi.fn().mockResolvedValue(result),
    } as unknown as ProductService;
    const controller = createProductController(productService);
    const response = responseDouble();
    const query = {
      q: '',
      category: '',
      subcategory: '',
      seller: '',
      status: '',
      availability: '',
      sort: 'created_desc',
      limit: 20,
      offset: 0,
    };

    await controller.index(
      { validated: { query } } as unknown as never,
      response,
    );
    await controller.listBySeller(
      {
        validated: { params: { userId: product.seller }, query },
      } as unknown as never,
      response,
    );

    expect(productService.listProducts).toHaveBeenCalledWith('', query);
    expect(productService.listProductsBySeller).toHaveBeenCalledWith(
      product.seller,
      '',
      query,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(result);
  });

  it('returns product detail and maps a missing product to the public error', async () => {
    const getProductById = vi
      .fn()
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(null);
    const controller = createProductController({
      getProductById,
    } as unknown as ProductService);
    const response = responseDouble();
    const request = {
      validated: { params: { productId: product._id } },
    } as unknown as never;

    await controller.detail(request, response);
    await expect(controller.detail(request, response)).rejects.toMatchObject({
      statusCode: 404,
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product not found',
    });

    expect(getProductById).toHaveBeenCalledWith(product._id, '');
    expect(response.send).toHaveBeenCalledWith(product);
  });

  it('uses empty request context fallbacks when creating a product', async () => {
    const createProduct = vi.fn().mockResolvedValue(product);
    const controller = createProductController({
      createProduct,
    } as unknown as ProductService);
    const response = responseDouble();

    await controller.add(
      { validated: { body: {} } } as unknown as never,
      response,
    );

    expect(createProduct).toHaveBeenCalledWith({}, '', '');
  });

  it.each([
    ['update', 'updateProduct', { name: 'Updated' }],
    ['updateStatus', 'updateProductStatus', { status: 'paused' }],
    ['updateInventory', 'updateProductInventory', { inventory: 4 }],
  ] as const)(
    '%s delegates the validated mutation with request context fallbacks',
    async (controllerMethod, serviceMethod, body) => {
      const mutation = vi.fn().mockResolvedValue(product);
      const controller = createProductController({
        [serviceMethod]: mutation,
      } as unknown as ProductService);
      const response = responseDouble();

      await controller[controllerMethod](
        {
          validated: { params: { productId: product._id }, body },
        } as unknown as never,
        response,
      );

      expect(mutation).toHaveBeenCalledWith(product._id, body, '', '');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.send).toHaveBeenCalledWith(product);
    },
  );
});
