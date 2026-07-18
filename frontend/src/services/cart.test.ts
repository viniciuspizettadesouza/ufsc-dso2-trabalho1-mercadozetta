import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  type Cart,
  getCart,
  putCartItem,
  removeCartItem,
} from '@/services/cart';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const cart = {
  tenantId: 'mercadozetta',
  buyer: '11111111-1111-4111-8111-111111111111',
  items: [],
} satisfies Cart;

describe('cart service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('loads the cart through the shared route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: cart });

    await expect(getCart()).resolves.toBe(cart);

    expect(api.get).toHaveBeenCalledWith('/cart');
  });

  it('puts a cart item and returns the server cart', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: cart });
    const input = { productId: 'product-1', quantity: 2 };

    await expect(putCartItem(input)).resolves.toBe(cart);

    expect(api.put).toHaveBeenCalledWith('/cart/items', input);
  });

  it('removes a cart item and returns the server cart', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: cart });

    await expect(removeCartItem('product-1')).resolves.toBe(cart);

    expect(api.delete).toHaveBeenCalledWith('/cart/items/product-1');
  });
});
