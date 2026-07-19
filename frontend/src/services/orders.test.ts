import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  createOrder,
  listOrders,
  type Order,
  type OrderList,
  updateOrderStatus,
} from '@/services/orders';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const order = {
  _id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'mercadozetta',
  buyer: '22222222-2222-4222-8222-222222222222',
  status: 'placed',
  statusHistory: [],
  items: [],
  createdAt: '2026-07-18T10:00:00.000Z',
  updatedAt: '2026-07-18T10:00:00.000Z',
} satisfies Order;
const orders = {
  items: [order],
  page: { limit: 20, offset: 0, total: 1, hasMore: false },
} satisfies OrderList;
const idempotencyKey = '33333333-3333-4333-8333-333333333333';

describe('order service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('loads an unpaginated buyer order list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: orders });

    await expect(
      listOrders({
        userId: order.buyer,
        scope: 'buyer',
        limit: null,
        offset: null,
        status: '',
        q: '',
      }),
    ).resolves.toBe(orders);

    expect(api.get).toHaveBeenCalledWith('/orders?scope=buyer');
  });

  it('serializes a paginated seller order list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: orders });

    await listOrders({
      userId: 'seller-1',
      scope: 'seller',
      limit: 20,
      offset: 40,
      status: '',
      q: '',
    });

    expect(api.get).toHaveBeenCalledWith(
      '/orders?scope=seller&limit=20&offset=40',
    );
  });

  it('serializes seller status and escaped text filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: orders });

    await listOrders({
      userId: 'seller-1',
      scope: 'seller',
      limit: 20,
      offset: 0,
      status: 'confirmed',
      q: 'Coffee beans',
    });

    expect(api.get).toHaveBeenCalledWith(
      '/orders?scope=seller&status=confirmed&q=Coffee+beans&limit=20&offset=0',
    );
  });

  it('checks out and returns the created order', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: order });

    await expect(createOrder(idempotencyKey)).resolves.toBe(order);

    expect(api.post).toHaveBeenCalledWith('/orders', undefined, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  });

  it('updates lifecycle status and returns the server order', async () => {
    const updated = { ...order, status: 'confirmed' as const };
    vi.mocked(api.patch).mockResolvedValue({ data: updated });

    await expect(
      updateOrderStatus(order._id, { status: 'confirmed' }),
    ).resolves.toBe(updated);

    expect(api.patch).toHaveBeenCalledWith(`/orders/${order._id}/status`, {
      status: 'confirmed',
    });
  });
});
