import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../src/model/product', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/services/userService', () => ({
  default: {
    getPublicSellerProfile: vi.fn(),
  },
}));

import Product from '../src/model/product';
import { createProduct, getProductById, listProducts, listProductsBySeller } from '../src/services/productService';
import UserService from '../src/services/userService';

const mockedProduct = Product as unknown as {
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

describe('product service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProduct.find.mockReset();
    mockedProduct.findOne.mockReset();
    mockedProduct.create.mockReset();
  });

  it('creates and lists products using the migrated product service', async () => {
    const productId = new Types.ObjectId('607f1f77bcf86cd799439012');
    const sellerId = new Types.ObjectId('507f1f77bcf86cd799439011');

    mockedProduct.create.mockResolvedValue({
      toObject: () => ({ _id: productId, name: 'Bike', inventory: 2, seller: sellerId }),
    });

    const createdProduct = await createProduct({
      name: 'Bike',
      inventory: 2,
      image: 'bike.png',
    }, 'seller-1', 'mercadozetta');

    expect(createdProduct).toEqual({
      toObject: expect.any(Function),
    });

    mockedProduct.find.mockResolvedValue([
      { name: 'Bike', inventory: 2, createdAt: '2024-01-02T00:00:00.000Z', seller: sellerId, status: 'active', description: 'desc', category: 'general', subcategory: '' },
      { name: 'Alpha', inventory: 1, createdAt: '2024-01-01T00:00:00.000Z', seller: sellerId, status: 'active', description: 'desc', category: 'general', subcategory: '' },
    ]);

    const products = await listProducts('mercadozetta');

    expect(products).toHaveLength(2);
    expect(products[0].name).toBe('Bike');

    mockedProduct.findOne.mockResolvedValue({
      toObject: () => ({ _id: productId, seller: sellerId, name: 'Bike', inventory: 2 }),
    });
    vi.spyOn(UserService, 'getPublicSellerProfile').mockResolvedValue({
      _id: sellerId,
      username: 'Seller',
      telephone: '123',
      email: 'seller@example.com',
      storeName: 'Seller store',
    });

    const productById = await getProductById(String(productId), 'mercadozetta');

    expect(productById).toEqual(expect.objectContaining({
      _id: productId,
      sellerProfile: expect.objectContaining({ username: 'Seller' }),
    }));

    await expect(listProductsBySeller('not-an-id', 'mercadozetta')).rejects.toThrowError();
  });
});
