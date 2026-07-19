import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  createProduct,
  getProduct,
  listProducts,
  updateProductDetails,
  updateProductInventory,
  updateProductStatus,
  type Product,
} from '@/services/products';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const product = { _id: 'product-1' } as Product;

describe('product service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('serializes catalog and seller list requests through shared routes', async () => {
    const page = {
      items: [product],
      page: { limit: 10, offset: 20, total: 1, hasMore: false },
    };
    vi.mocked(api.get).mockResolvedValue({ data: page });

    await expect(
      listProducts({
        sellerId: null,
        q: 'coffee beans',
        category: 'grocery',
        availability: 'in_stock',
        sort: 'name_asc',
        limit: 10,
        offset: 20,
      }),
    ).resolves.toBe(page);
    expect(api.get).toHaveBeenCalledWith(
      '/products?q=coffee+beans&category=grocery&availability=in_stock&sort=name_asc&limit=10&offset=20',
    );

    await listProducts({
      sellerId: 'seller-1',
      q: '',
      category: '',
      availability: '',
      sort: '',
      limit: null,
      offset: null,
    });
    expect(api.get).toHaveBeenLastCalledWith('/users/seller-1/products');
  });

  it('loads product detail through the shared route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: product });

    await expect(getProduct('product-1')).resolves.toBe(product);

    expect(api.get).toHaveBeenCalledWith('/products/product-1');
  });

  it('creates products and returns the typed server response', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: product });
    const input = {
      name: 'Coffee',
      description: 'Beans',
      category: 'grocery',
      subcategory: 'coffee',
      image: 'coffee.png',
      inventory: 2,
      status: 'active' as const,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    };

    await expect(createProduct(input)).resolves.toBe(product);

    const { idempotencyKey, ...body } = input;
    expect(api.post).toHaveBeenCalledWith('/products', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  });

  it('updates product details, inventory, and status through domain routes', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: product });
    const details = {
      name: 'Coffee',
      description: 'Beans',
      category: 'grocery',
      subcategory: 'coffee',
      image: 'coffee.png',
    };

    await expect(updateProductDetails('product-1', details)).resolves.toBe(
      product,
    );
    await expect(
      updateProductInventory('product-1', { inventory: 4 }),
    ).resolves.toBe(product);
    await expect(
      updateProductStatus('product-1', { status: 'paused' }),
    ).resolves.toBe(product);

    expect(api.patch).toHaveBeenNthCalledWith(
      1,
      '/products/product-1',
      details,
    );
    expect(api.patch).toHaveBeenNthCalledWith(
      2,
      '/products/product-1/inventory',
      { inventory: 4 },
    );
    expect(api.patch).toHaveBeenNthCalledWith(3, '/products/product-1/status', {
      status: 'paused',
    });
  });
});
