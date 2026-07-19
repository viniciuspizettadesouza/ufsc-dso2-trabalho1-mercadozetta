import { describe, expect, it, vi } from 'vitest';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { createOrderCommerceService } from '@/services/commerceService';

const tenantId = 'mercadozetta';
const buyerId = '507f191e-810c-4197-9de8-60ea00000001';
const sellerId = '507f191e-810c-4197-9de8-60ea00000002';
const orderId = '507f191e-810c-4197-9de8-60ea00000003';
const now = new Date('2026-07-19T15:00:00.000Z');
const order = {
  _id: orderId,
  tenantId,
  buyer: buyerId,
  status: 'confirmed' as const,
  statusHistory: [
    { status: 'confirmed' as const, actor: sellerId, changedAt: now },
  ],
  createdAt: now,
  updatedAt: now,
};
const sellerItem = {
  tenantId,
  order: orderId,
  product: '507f191e-810c-4197-9de8-60ea00000004',
  seller: sellerId,
  productName: 'Keyboard',
  quantity: 1,
};

describe('commerceService order lifecycle', () => {
  it('replays an already-applied status without duplicate side effects', async () => {
    const orders = {
      findById: vi.fn().mockResolvedValue(order),
      updateStatus: vi.fn(),
    };
    const orderItems = {
      sellerOwnsOrder: vi.fn().mockResolvedValue(true),
      listByOrderIds: vi.fn().mockResolvedValue([sellerItem]),
    };
    const notifications = { create: vi.fn() };
    const audits = { append: vi.fn() };
    const repositories = { orders, orderItems, notifications, audits };
    const transactions = {
      run: vi.fn((work) => work(repositories as never)),
    } as unknown as CheckoutTransactionCoordinator;
    const service = createOrderCommerceService(
      orders as never,
      orderItems as never,
      notifications as never,
      transactions,
    );

    await expect(
      service.updateOrderStatus(sellerId, tenantId, orderId, 'confirmed'),
    ).resolves.toEqual({ ...order, items: [sellerItem] });

    expect(orderItems.sellerOwnsOrder).toHaveBeenCalledWith(
      tenantId,
      orderId,
      sellerId,
    );
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(audits.append).not.toHaveBeenCalled();
  });
});
