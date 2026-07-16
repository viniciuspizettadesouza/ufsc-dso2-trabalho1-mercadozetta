import { describe, expect, it, vi } from 'vitest';
import type { ProductRepository } from '@/repositories/productRepository';
import { createProductService } from '@/services/productService';

function repository(
  overrides: Partial<ProductRepository> = {},
): ProductRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findActiveById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    findByIdsForUpdate: vi.fn().mockResolvedValue([]),
    decrementAvailableInventory: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

const productId = '507f191e-810c-4197-9de8-60ea00000001';
const missingProductId = '507f191e-810c-4197-9de8-60ea00000002';
const sellerId = '507f1f77-bcf8-4ecd-8994-390110000001';
const products = [
  {
    _id: 'product-1',
    tenantId: 'mercadozetta',
    name: 'Mouse',
    description: 'Wireless mouse',
    category: 'peripherals',
    subcategory: 'mice',
    seller: sellerId,
    image: 'mouse.png',
    status: 'active' as const,
    inventory: 5,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
  },
  {
    _id: 'product-2',
    tenantId: 'mercadozetta',
    name: 'Keyboard',
    description: 'Mechanical keyboard',
    category: 'peripherals',
    subcategory: 'keyboards',
    seller: '507f1f77-bcf8-4ecd-8994-390110000002',
    image: 'keyboard.png',
    status: 'sold_out' as const,
    inventory: 0,
    createdAt: new Date('2024-01-03T00:00:00.000Z'),
  },
  {
    _id: 'product-3',
    tenantId: 'mercadozetta',
    name: 'Desk',
    description: 'Standing desk',
    category: 'furniture',
    subcategory: 'desks',
    seller: sellerId,
    image: 'desk.png',
    status: 'paused' as const,
    inventory: 2,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  },
];

function service(productRepository: ProductRepository, profile = vi.fn()) {
  return createProductService(productRepository, {
    getPublicSellerProfile: profile,
  });
}

describe('productService', () => {
  it('lists products with text, category, availability, and sort filters', async () => {
    const productRepository = repository({
      list: vi.fn().mockResolvedValue(products),
    });
    const { listProducts } = service(productRepository);

    const result = await listProducts('campus-market', {
      q: 'keyboard',
      category: 'peripherals',
      availability: 'sold_out',
      sort: 'name_asc',
    });

    expect(productRepository.list).toHaveBeenCalledWith('campus-market');
    expect(result.map((product) => product._id)).toEqual(['product-2']);
  });

  it('uses the default tenant and applies seller and stock filters', async () => {
    const productRepository = repository({
      list: vi.fn().mockResolvedValue(products),
    });
    const { listProducts } = service(productRepository);

    const result = await listProducts(undefined, {
      subcategory: 'mice',
      seller: sellerId,
      status: 'active',
      availability: 'in_stock',
    });

    expect(productRepository.list).toHaveBeenCalledWith('mercadozetta');
    expect(result.map((product) => product._id)).toEqual(['product-1']);
  });

  it('sorts products by creation, name, and inventory', async () => {
    const { listProducts } = service(
      repository({ list: vi.fn().mockResolvedValue(products) }),
    );

    await expect(
      listProducts('mercadozetta', { sort: 'created_asc' }),
    ).resolves.toMatchObject([
      { _id: 'product-3' },
      { _id: 'product-1' },
      { _id: 'product-2' },
    ]);
    await expect(
      listProducts('mercadozetta', { sort: 'name_asc' }),
    ).resolves.toMatchObject([
      { _id: 'product-3' },
      { _id: 'product-2' },
      { _id: 'product-1' },
    ]);
    await expect(
      listProducts('mercadozetta', { sort: 'inventory_desc' }),
    ).resolves.toMatchObject([
      { _id: 'product-1' },
      { _id: 'product-3' },
      { _id: 'product-2' },
    ]);
  });

  it('creates products with validated payload, seller, and tenant', async () => {
    const create = vi.fn().mockResolvedValue({ _id: 'product-1' });
    const { createProduct } = service(repository({ create }));

    await expect(
      createProduct(
        { name: ' Keyboard ', inventory: '2', image: 'keyboard.png' },
        sellerId,
        'campus-market',
      ),
    ).resolves.toEqual({ _id: 'product-1' });
    expect(create).toHaveBeenCalledWith({
      name: 'Keyboard',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 2,
      image: 'keyboard.png',
      status: 'active',
      seller: sellerId,
      tenantId: 'campus-market',
    });
  });

  it('returns product detail with seller profile when available', async () => {
    const product = { ...products[0], _id: productId };
    const profile = vi.fn().mockResolvedValue({
      _id: sellerId,
      username: 'Seller',
    });
    const productRepository = repository({
      findById: vi.fn().mockResolvedValue(product),
    });
    const { getProductById } = service(productRepository, profile);

    await expect(
      getProductById(` ${productId} `, 'mercadozetta'),
    ).resolves.toMatchObject({
      _id: productId,
      sellerProfile: { _id: sellerId, username: 'Seller' },
    });
    expect(productRepository.findById).toHaveBeenCalledWith(
      'mercadozetta',
      productId,
    );
    expect(profile).toHaveBeenCalledWith(sellerId, 'mercadozetta');
  });

  it('returns null for missing products and falls back on profile errors', async () => {
    let { getProductById } = service(repository());
    await expect(
      getProductById(missingProductId, 'mercadozetta'),
    ).resolves.toBeNull();

    const product = { ...products[0], _id: productId };
    ({ getProductById } = service(
      repository({ findById: vi.fn().mockResolvedValue(product) }),
      vi.fn().mockRejectedValue(new Error('seller missing')),
    ));
    await expect(getProductById(productId, 'mercadozetta')).resolves.toBe(
      product,
    );
  });

  it('lists products by a validated seller', async () => {
    const list = vi.fn().mockResolvedValue(products);
    const { listProductsBySeller } = service(repository({ list }));

    const result = await listProductsBySeller(sellerId, 'campus-market', {
      status: 'active',
    });

    expect(list).toHaveBeenCalledWith('campus-market', sellerId);
    expect(result.map((product) => product._id)).toEqual(['product-1']);
  });
});
