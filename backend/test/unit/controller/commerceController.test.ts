import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/commerceService', () => ({
  getCart: vi.fn(),
  setCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  listWatchlist: vi.fn(),
  addWatchlist: vi.fn(),
  removeWatchlist: vi.fn(),
  createOrder: vi.fn(),
  listOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  listReviews: vi.fn(),
  createReview: vi.fn(),
  listNotifications: vi.fn(),
  countUnreadNotifications: vi.fn(),
  updateNotificationRead: vi.fn(),
}));

import type { Request, Response } from 'express';
import * as Controller from '@/controller/commerceController';
import * as Commerce from '@/services/commerceService';

describe('commerce controller', () => {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const response = { send, status } as unknown as Response;
  const request = (body?: object, params?: object) =>
    ({
      userId: 'user-1',
      tenant: { id: 'mercadozetta' },
      validated: { body, params },
    }) as unknown as Request;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(Commerce).forEach((value) => {
      if (typeof value === 'function')
        vi.mocked(value).mockResolvedValue({ result: true } as never);
    });
  });

  it('maps cart operations to the authenticated context', async () => {
    await Controller.getCart(request(), response);
    await Controller.setCartItem(
      request({ productId: 'product-1', quantity: 2 }),
      response,
    );
    await Controller.removeCartItem(
      request(undefined, { productId: 'product-1' }),
      response,
    );
    expect(Commerce.getCart).toHaveBeenCalledWith('user-1', 'mercadozetta');
    expect(Commerce.setCartItem).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      'product-1',
      2,
    );
    expect(Commerce.removeCartItem).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      'product-1',
    );
  });

  it('maps watchlist operations and deletion response', async () => {
    await Controller.listWatchlist(request(), response);
    await Controller.addWatchlist(
      request(undefined, { productId: 'product-1' }),
      response,
    );
    await Controller.removeWatchlist(
      request(undefined, { productId: 'product-1' }),
      response,
    );
    expect(Commerce.listWatchlist).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(status).toHaveBeenCalledWith(204);
  });

  it('maps order operations and lifecycle input', async () => {
    await Controller.createOrder(request(), response);
    await Controller.listOrders(request(), response);
    await Controller.updateOrderStatus(
      request({ status: 'shipped' }, { orderId: 'order-1' }),
      response,
    );
    expect(Commerce.createOrder).toHaveBeenCalledWith('user-1', 'mercadozetta');
    expect(Commerce.listOrders).toHaveBeenCalledWith('user-1', 'mercadozetta');
    expect(Commerce.updateOrderStatus).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      'order-1',
      'shipped',
    );
  });

  it('maps review and notification operations', async () => {
    await Controller.listReviews(
      request(undefined, { productId: 'product-1' }),
      response,
    );
    await Controller.createReview(
      request({ rating: 5, comment: 'Great' }, { productId: 'product-1' }),
      response,
    );
    await Controller.listNotifications(request(), response);
    await Controller.countUnreadNotifications(request(), response);
    await Controller.updateNotificationRead(
      request({ read: true }, { notificationId: 'notification-1' }),
      response,
    );
    expect(Commerce.listReviews).toHaveBeenCalledWith(
      'mercadozetta',
      'product-1',
    );
    expect(Commerce.createReview).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      'product-1',
      5,
      'Great',
    );
    expect(Commerce.listNotifications).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
    );
    expect(Commerce.countUnreadNotifications).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
    );
    expect(Commerce.updateNotificationRead).toHaveBeenCalledWith(
      'user-1',
      'mercadozetta',
      'notification-1',
      true,
    );
  });

  it('uses empty context values when auth and tenant context are absent', async () => {
    const anonymous = {
      validated: { params: { productId: 'product-1' } },
    } as unknown as Request;
    await Controller.getCart(anonymous, response);
    await Controller.listReviews(anonymous, response);
    expect(Commerce.getCart).toHaveBeenCalledWith('', '');
    expect(Commerce.listReviews).toHaveBeenCalledWith('', 'product-1');
  });
});
