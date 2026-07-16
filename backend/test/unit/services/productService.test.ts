import { describe, expect, it, vi } from 'vitest';
import type { ProductRepository } from '@/repositories/productRepository';
import { createProductService } from '@/services/productService';

function repository(
  overrides: Partial<ProductRepository> = {},
): ProductRepository {
  return {
    list: vi.fn().mockResolvedValue({
      items: [],
      page: { limit: 20, offset: 0, total: 0, hasMore: false },
    }),
    create: vi.fn(),
    updateOwned: vi.fn().mockResolvedValue(null),
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
    const list = vi.fn().mockResolvedValue({
      items: [products[1]],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    const productRepository = repository({
      list,
    });
    const { listProducts } = service(productRepository);

    const result = await listProducts('campus-market', {
      q: 'keyboard',
      category: 'peripherals',
      availability: 'sold_out',
      sort: 'name_asc',
    });

    expect(list).toHaveBeenCalledWith('campus-market', {
      q: 'keyboard',
      category: 'peripherals',
      subcategory: '',
      seller: '',
      status: '',
      availability: 'sold_out',
      sort: 'name_asc',
      limit: 20,
      offset: 0,
    });
    expect(result.items.map((product) => product._id)).toEqual(['product-2']);
  });

  it('uses the default tenant and applies seller and stock filters', async () => {
    const list = vi.fn().mockResolvedValue({
      items: [products[0]],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    const productRepository = repository({
      list,
    });
    const { listProducts } = service(productRepository);

    const result = await listProducts(undefined, {
      subcategory: 'mice',
      seller: sellerId,
      status: 'active',
      availability: 'in_stock',
    });

    expect(list).toHaveBeenCalledWith('mercadozetta', {
      q: '',
      category: '',
      subcategory: 'mice',
      seller: sellerId,
      status: 'active',
      availability: 'in_stock',
      sort: 'created_desc',
      limit: 20,
      offset: 0,
    });
    expect(result.items.map((product) => product._id)).toEqual(['product-1']);
  });

  it('passes each supported sort to the repository', async () => {
    const list = vi.fn().mockResolvedValue({
      items: products,
      page: { limit: 20, offset: 0, total: 3, hasMore: false },
    });
    const { listProducts } = service(repository({ list }));

    for (const sort of ['created_asc', 'name_asc', 'inventory_desc'])
      await listProducts('mercadozetta', { sort });

    expect(list.mock.calls.map(([, query]) => query.sort)).toEqual([
      'created_asc',
      'name_asc',
      'inventory_desc',
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
    const list = vi.fn().mockResolvedValue({
      items: [products[0]],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    const { listProductsBySeller } = service(repository({ list }));

    const result = await listProductsBySeller(sellerId, 'campus-market', {
      status: 'active',
    });

    expect(list).toHaveBeenCalledWith('campus-market', {
      q: '',
      category: '',
      subcategory: '',
      seller: sellerId,
      status: 'active',
      availability: '',
      sort: 'created_desc',
      limit: 20,
      offset: 0,
    });
    expect(result.items.map((product) => product._id)).toEqual(['product-1']);
  });

  it('updates only explicit editable fields for the owning seller', async () => {
    const updateOwned = vi.fn().mockResolvedValue({
      ...products[0],
      name: 'Updated',
    });
    const { updateProduct } = service(
      repository({
        findById: vi.fn().mockResolvedValue({
          ...products[0],
          _id: productId,
        }),
        updateOwned,
      }),
    );

    await updateProduct(
      productId,
      {
        name: ' Updated ',
        seller: 'attacker',
        tenantId: 'campus-market',
        inventory: 999,
        status: 'archived',
      },
      sellerId,
      'mercadozetta',
    );

    expect(updateOwned).toHaveBeenCalledWith(
      'mercadozetta',
      productId,
      sellerId,
      { name: 'Updated' },
    );
  });

  it('denies product management to other sellers and tenants', async () => {
    const { updateProduct } = service(
      repository({
        findById: vi.fn().mockResolvedValue({
          ...products[0],
          _id: productId,
        }),
      }),
    );
    await expect(
      updateProduct(
        productId,
        { name: 'Nope' },
        'other-seller',
        'mercadozetta',
      ),
    ).rejects.toMatchObject({ code: 'PRODUCT_FORBIDDEN' });

    const missing = service(repository()).updateProduct;
    await expect(
      missing(productId, { name: 'Nope' }, sellerId, 'campus-market'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('enforces lifecycle transitions and inventory-managed sold-out state', async () => {
    const updateOwned = vi
      .fn()
      .mockImplementation(async (_tenant, _product, _seller, update) => ({
        ...products[0],
        ...update,
      }));
    const productRepository = repository({
      findById: vi.fn().mockResolvedValue({
        ...products[0],
        _id: productId,
        inventory: 5,
        status: 'active',
      }),
      updateOwned,
    });
    const productService = service(productRepository);

    await productService.updateProductStatus(
      productId,
      { status: 'paused' },
      sellerId,
      'mercadozetta',
    );
    expect(updateOwned).toHaveBeenLastCalledWith(
      'mercadozetta',
      productId,
      sellerId,
      { status: 'paused' },
    );
    await expect(
      productService.updateProductStatus(
        productId,
        { status: 'sold_out' },
        sellerId,
        'mercadozetta',
      ),
    ).rejects.toMatchObject({ code: 'PRODUCT_STATUS_TRANSITION_INVALID' });

    await productService.updateProductInventory(
      productId,
      { inventory: 0 },
      sellerId,
      'mercadozetta',
    );
    expect(updateOwned).toHaveBeenLastCalledWith(
      'mercadozetta',
      productId,
      sellerId,
      { inventory: 0, status: 'sold_out' },
    );
  });
});
