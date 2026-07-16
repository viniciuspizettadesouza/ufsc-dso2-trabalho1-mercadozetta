import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

vi.mock('@/model/cart', () => ({
  default: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('@/model/notification', () => ({
  default: {
    create: vi.fn(),
    insertMany: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
vi.mock('@/model/order', () => ({
  default: { create: vi.fn(), find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('@/model/orderItem', () => ({
  default: { insertMany: vi.fn(), exists: vi.fn(), find: vi.fn() },
}));
vi.mock('@/model/product', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    exists: vi.fn(),
    updateOne: vi.fn(),
  },
}));
vi.mock('@/model/review', () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('@/model/watchlist', () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), deleteOne: vi.fn() },
}));

import Cart from '@/model/cart';
import Notification from '@/model/notification';
import Order from '@/model/order';
import OrderItem from '@/model/orderItem';
import Product from '@/model/product';
import Review from '@/model/review';
import Watchlist from '@/model/watchlist';
import {
  addWatchlist,
  createOrder,
  createReview,
  countUnreadNotifications,
  getCart,
  listNotifications,
  listOrders,
  listReviews,
  listWatchlist,
  removeCartItem,
  removeWatchlist,
  setCartItem,
  updateNotificationRead,
  updateOrderStatus,
} from '@/services/commerceService';

describe('commerce service authorization', () => {
  const session = {
    withTransaction: vi.fn(async (work: () => Promise<void>) => work()),
    endSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
  });

  it('returns an empty cart and persists cart item changes', async () => {
    vi.mocked(Cart.findOne).mockReturnValueOnce({
      populate: vi.fn().mockResolvedValue(null),
    } as never);
    await expect(getCart('buyer-1', 'mercadozetta')).resolves.toEqual({
      tenantId: 'mercadozetta',
      buyer: 'buyer-1',
      items: [],
    });

    const save = vi.fn();
    vi.mocked(Product.findOne).mockResolvedValue({
      _id: 'product-1',
      inventory: 3,
    } as never);
    vi.mocked(Cart.findOneAndUpdate).mockResolvedValue({
      items: [],
      save,
    } as never);
    vi.mocked(Cart.findOne).mockReturnValueOnce({
      populate: vi
        .fn()
        .mockResolvedValue({ items: [{ product: 'product-1', quantity: 2 }] }),
    } as never);
    await setCartItem('buyer-1', 'mercadozetta', 'product-1', 2);
    expect(save).toHaveBeenCalled();
    expect(Cart.findOneAndUpdate).toHaveBeenCalledWith(
      { tenantId: 'mercadozetta', buyer: 'buyer-1' },
      { $setOnInsert: { tenantId: 'mercadozetta', buyer: 'buyer-1' } },
      { upsert: true, returnDocument: 'after' },
    );

    vi.mocked(Cart.findOne).mockReturnValueOnce({
      populate: vi.fn().mockResolvedValue({ items: [] }),
    } as never);
    await removeCartItem('buyer-1', 'mercadozetta', 'product-1');
    expect(Cart.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ buyer: 'buyer-1' }),
      { $pull: { items: { product: 'product-1' } } },
    );
  });

  it('updates an existing cart line and treats missing inventory as unavailable', async () => {
    const existing = { product: 'product-1', quantity: 1 };
    const save = vi.fn();
    vi.mocked(Product.findOne).mockResolvedValueOnce({
      _id: 'product-1',
      inventory: 4,
    } as never);
    vi.mocked(Cart.findOneAndUpdate).mockResolvedValueOnce({
      items: [existing],
      save,
    } as never);
    vi.mocked(Cart.findOne).mockReturnValueOnce({
      populate: vi.fn().mockResolvedValue({ items: [existing] }),
    } as never);
    await setCartItem('buyer-1', 'mercadozetta', 'product-1', 3);
    expect(existing.quantity).toBe(3);

    vi.mocked(Product.findOne).mockResolvedValueOnce({
      _id: 'product-1',
    } as never);
    await expect(
      setCartItem('buyer-1', 'mercadozetta', 'product-1', 1),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_INVENTORY' });
  });

  it('persists and lists tenant-scoped watchlist entries', async () => {
    const populate = vi.fn().mockResolvedValue([{ product: 'product-1' }]);
    vi.mocked(Watchlist.find).mockReturnValue({ populate } as never);
    await listWatchlist('buyer-1', 'mercadozetta');
    expect(Watchlist.find).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      user: 'buyer-1',
    });

    vi.mocked(Product.exists).mockResolvedValue({ _id: 'product-1' } as never);
    vi.mocked(Watchlist.findOneAndUpdate).mockResolvedValue({
      product: 'product-1',
    } as never);
    await addWatchlist('buyer-1', 'mercadozetta', 'product-1');
    expect(Watchlist.findOneAndUpdate).toHaveBeenCalledWith(
      {
        tenantId: 'mercadozetta',
        user: 'buyer-1',
        product: 'product-1',
      },
      {
        $setOnInsert: {
          tenantId: 'mercadozetta',
          user: 'buyer-1',
          product: 'product-1',
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    await removeWatchlist('buyer-1', 'mercadozetta', 'product-1');
    expect(Watchlist.deleteOne).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      user: 'buyer-1',
      product: 'product-1',
    });
  });

  it('lists product reviews and user notifications newest first', async () => {
    const reviewSort = vi.fn().mockResolvedValue([{ comment: 'Great' }]);
    const notificationSort = vi
      .fn()
      .mockResolvedValue([{ message: 'Order created' }]);
    vi.mocked(Review.find).mockReturnValue({ sort: reviewSort } as never);
    vi.mocked(Notification.find).mockReturnValue({
      sort: notificationSort,
    } as never);
    await listReviews('mercadozetta', 'product-1');
    await listNotifications('buyer-1', 'mercadozetta');
    expect(reviewSort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(notificationSort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('counts and updates only the current user tenant notifications', async () => {
    vi.mocked(Notification.countDocuments).mockResolvedValue(2);
    vi.mocked(Notification.findOneAndUpdate).mockResolvedValue({
      _id: 'notification-1',
      read: true,
    } as never);

    await expect(
      countUnreadNotifications('buyer-1', 'mercadozetta'),
    ).resolves.toBe(2);
    await updateNotificationRead(
      'buyer-1',
      'mercadozetta',
      'notification-1',
      true,
    );

    expect(Notification.countDocuments).toHaveBeenCalledWith({
      tenantId: 'mercadozetta',
      user: 'buyer-1',
      read: false,
    });
    expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'notification-1',
        tenantId: 'mercadozetta',
        user: 'buyer-1',
      },
      { read: true },
      { returnDocument: 'after' },
    );
  });

  it('rejects updates to notifications outside the current user scope', async () => {
    vi.mocked(Notification.findOneAndUpdate).mockResolvedValue(null);

    await expect(
      updateNotificationRead(
        'buyer-1',
        'mercadozetta',
        'notification-1',
        false,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTIFICATION_NOT_FOUND',
    });
  });

  it('creates an order, order items, notifications, and clears the cart', async () => {
    vi.mocked(Cart.findOne).mockResolvedValue({
      _id: 'cart-1',
      items: [{ product: 'product-1', quantity: 2 }],
    } as never);
    vi.mocked(Product.find).mockResolvedValue([
      {
        _id: 'product-1',
        seller: 'seller-1',
        name: 'Coffee',
        status: 'active',
        inventory: 3,
      },
    ] as never);
    vi.mocked(Order.create).mockResolvedValue([
      {
        _id: 'order-1',
        toObject: () => ({ _id: 'order-1', status: 'placed' }),
      },
    ] as never);
    vi.mocked(OrderItem.insertMany).mockResolvedValue([] as never);
    vi.mocked(Product.updateOne).mockResolvedValue({
      modifiedCount: 1,
    } as never);
    vi.mocked(Notification.create).mockResolvedValue({} as never);
    vi.mocked(Notification.insertMany).mockResolvedValue([] as never);

    const order = await createOrder('buyer-1', 'mercadozetta');

    expect(order).toMatchObject({
      _id: 'order-1',
      items: [{ productName: 'Coffee', quantity: 2 }],
    });
    expect(Order.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          status: 'placed',
          statusHistory: [{ status: 'placed', actor: 'buyer-1' }],
        }),
      ],
      { session },
    );
    expect(OrderItem.insertMany).toHaveBeenCalled();
    expect(Cart.updateOne).toHaveBeenCalledWith(
      { _id: 'cart-1', tenantId: 'mercadozetta' },
      { $set: { items: [] } },
      { session },
    );
    expect(Notification.insertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ user: 'seller-1' })],
      { session },
    );
    expect(session.endSession).toHaveBeenCalled();
  });

  it('rolls back checkout when a conditional inventory decrement loses a race', async () => {
    vi.mocked(Cart.findOne).mockResolvedValue({
      _id: 'cart-1',
      items: [{ product: 'product-1', quantity: 2 }],
    } as never);
    vi.mocked(Product.find).mockResolvedValue([
      {
        _id: 'product-1',
        seller: 'seller-1',
        name: 'Coffee',
        status: 'active',
        inventory: 2,
      },
    ] as never);
    vi.mocked(Order.create).mockResolvedValue([
      { _id: 'order-1', toObject: vi.fn() },
    ] as never);
    vi.mocked(OrderItem.insertMany).mockResolvedValue([] as never);
    vi.mocked(Product.updateOne).mockResolvedValue({
      modifiedCount: 0,
    } as never);

    await expect(createOrder('buyer-1', 'mercadozetta')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INSUFFICIENT_INVENTORY',
    });

    expect(Product.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'mercadozetta',
        status: 'active',
        inventory: { $gte: 2 },
      }),
      { $inc: { inventory: -2 } },
      { session },
    );
    expect(Cart.updateOne).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it('rejects a checkout when the transaction finishes without a commit result', async () => {
    session.withTransaction.mockResolvedValueOnce(undefined);

    await expect(createOrder('buyer-1', 'mercadozetta')).rejects.toThrow(
      'Order transaction did not commit',
    );
    expect(session.endSession).toHaveBeenCalled();
  });

  it('lists orders visible to a buyer or seller with their items', async () => {
    const buyerSort = vi.fn().mockResolvedValue([{ _id: 'order-1' }]);
    const visibleSort = vi
      .fn()
      .mockResolvedValue([
        { _id: 'order-1', toObject: () => ({ _id: 'order-1' }) },
      ]);
    vi.mocked(Order.find)
      .mockReturnValueOnce({ sort: buyerSort } as never)
      .mockReturnValueOnce({ sort: visibleSort } as never);
    vi.mocked(OrderItem.find)
      .mockResolvedValueOnce([{ order: 'order-2' }] as never)
      .mockResolvedValueOnce([
        { order: 'order-1', productName: 'Coffee' },
      ] as never);

    await expect(listOrders('user-1', 'mercadozetta')).resolves.toEqual([
      { _id: 'order-1', items: [{ order: 'order-1', productName: 'Coffee' }] },
    ]);
  });

  it('rejects missing products, insufficient inventory, empty carts, and invalid reviews', async () => {
    vi.mocked(Product.findOne).mockResolvedValueOnce(null);
    await expect(
      setCartItem('buyer-1', 'mercadozetta', 'product-1', 1),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    vi.mocked(Product.findOne).mockResolvedValueOnce({ inventory: 0 } as never);
    await expect(
      setCartItem('buyer-1', 'mercadozetta', 'product-1', 1),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_INVENTORY' });
    vi.mocked(Product.exists).mockResolvedValueOnce(null);
    await expect(
      addWatchlist('buyer-1', 'mercadozetta', 'product-1'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    vi.mocked(Cart.findOne).mockResolvedValueOnce(null);
    await expect(createOrder('buyer-1', 'mercadozetta')).rejects.toMatchObject({
      code: 'EMPTY_CART',
    });
    vi.mocked(Product.findOne).mockResolvedValueOnce(null);
    await expect(
      createReview('buyer-1', 'mercadozetta', 'product-1', 5, 'Great'),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    vi.mocked(Product.findOne).mockResolvedValueOnce({
      seller: 'buyer-1',
    } as never);
    await expect(
      createReview('buyer-1', 'mercadozetta', 'product-1', 5, 'Great'),
    ).rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' });
  });

  it('rejects each unavailable order-item state', async () => {
    const cart = { items: [{ product: 'product-1', quantity: 2 }] };
    vi.mocked(Cart.findOne).mockResolvedValue(cart as never);
    vi.mocked(Product.find).mockResolvedValueOnce([]);
    await expect(createOrder('buyer-1', 'mercadozetta')).rejects.toMatchObject({
      code: 'INSUFFICIENT_INVENTORY',
    });
    vi.mocked(Product.find).mockResolvedValueOnce([
      { _id: 'product-1', status: 'paused', inventory: 3 },
    ] as never);
    await expect(createOrder('buyer-1', 'mercadozetta')).rejects.toMatchObject({
      code: 'INSUFFICIENT_INVENTORY',
    });
    vi.mocked(Product.find).mockResolvedValueOnce([
      { _id: 'product-1', status: 'active', inventory: 1 },
    ] as never);
    await expect(createOrder('buyer-1', 'mercadozetta')).rejects.toMatchObject({
      code: 'INSUFFICIENT_INVENTORY',
    });
  });

  it('allows a seller to advance an order and notifies its buyer', async () => {
    const save = vi.fn();
    const statusHistory: Array<object> = [];
    vi.mocked(Order.findOne).mockResolvedValue({
      _id: 'order-1',
      buyer: 'buyer-1',
      status: 'placed',
      statusHistory,
      save,
    } as never);
    vi.mocked(OrderItem.exists).mockResolvedValue({ _id: 'item-1' } as never);
    vi.mocked(Notification.create).mockResolvedValue({} as never);

    await updateOrderStatus('seller-1', 'mercadozetta', 'order-1', 'confirmed');

    expect(Order.findOne).toHaveBeenCalledWith({
      _id: 'order-1',
      tenantId: 'mercadozetta',
    });
    expect(save).toHaveBeenCalled();
    expect(statusHistory).toEqual([
      expect.objectContaining({ status: 'confirmed', actor: 'seller-1' }),
    ]);
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'buyer-1' }),
    );
  });

  it.each([
    ['confirmed', 'shipped'],
    ['shipped', 'delivered'],
  ] as const)(
    'allows the seller transition from %s to %s',
    async (from, to) => {
      const save = vi.fn();
      const statusHistory: Array<object> = [];
      vi.mocked(Order.findOne).mockResolvedValue({
        _id: 'order-1',
        buyer: 'buyer-1',
        status: from,
        statusHistory,
        save,
      } as never);
      vi.mocked(OrderItem.exists).mockResolvedValue({ _id: 'item-1' } as never);
      vi.mocked(Notification.create).mockResolvedValue({} as never);

      await updateOrderStatus('seller-1', 'mercadozetta', 'order-1', to);

      expect(save).toHaveBeenCalled();
      expect(statusHistory).toEqual([
        expect.objectContaining({ status: to, actor: 'seller-1' }),
      ]);
    },
  );

  it('rejects skipped and terminal order status transitions', async () => {
    vi.mocked(Order.findOne)
      .mockResolvedValueOnce({
        _id: 'order-1',
        buyer: 'buyer-1',
        status: 'placed',
      } as never)
      .mockResolvedValueOnce({
        _id: 'order-1',
        buyer: 'buyer-1',
        status: 'delivered',
      } as never);
    vi.mocked(OrderItem.exists)
      .mockResolvedValueOnce({ _id: 'item-1' } as never)
      .mockResolvedValueOnce(null);

    await expect(
      updateOrderStatus('seller-1', 'mercadozetta', 'order-1', 'shipped'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ORDER_STATUS_TRANSITION_INVALID',
    });
    await expect(
      updateOrderStatus('buyer-1', 'mercadozetta', 'order-1', 'cancelled'),
    ).rejects.toMatchObject({ code: 'ORDER_STATUS_TRANSITION_INVALID' });
  });

  it('rejects order updates from unrelated users', async () => {
    vi.mocked(Order.findOne).mockResolvedValue({
      _id: 'order-1',
      buyer: 'buyer-1',
      status: 'placed',
    } as never);
    vi.mocked(OrderItem.exists).mockResolvedValue(null);

    await expect(
      updateOrderStatus('other-user', 'mercadozetta', 'order-1', 'shipped'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ORDER_FORBIDDEN',
    });
  });

  it('allows a buyer cancellation and rejects an unknown order', async () => {
    const save = vi.fn();
    vi.mocked(Order.findOne).mockResolvedValueOnce({
      _id: 'order-1',
      buyer: 'buyer-1',
      status: 'placed',
      statusHistory: [],
      save,
    } as never);
    vi.mocked(OrderItem.exists).mockResolvedValueOnce(null);
    vi.mocked(Notification.create).mockResolvedValue({} as never);
    await updateOrderStatus('buyer-1', 'mercadozetta', 'order-1', 'cancelled');
    expect(save).toHaveBeenCalled();

    vi.mocked(Order.findOne).mockResolvedValueOnce(null);
    await expect(
      updateOrderStatus('buyer-1', 'mercadozetta', 'missing', 'cancelled'),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  it('allows only a purchasing buyer to review another seller product', async () => {
    vi.mocked(Product.findOne).mockResolvedValue({
      _id: 'product-1',
      seller: 'seller-1',
      name: 'Coffee',
    } as never);
    vi.mocked(Order.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue(['order-1']),
    } as never);
    vi.mocked(OrderItem.exists).mockResolvedValue({ _id: 'item-1' } as never);
    vi.mocked(Review.findOneAndUpdate).mockResolvedValue({
      _id: 'review-1',
      rating: 5,
    } as never);
    vi.mocked(Notification.create).mockResolvedValue({} as never);

    await createReview('buyer-1', 'mercadozetta', 'product-1', 5, 'Excellent');

    expect(Review.findOneAndUpdate).toHaveBeenCalledWith(
      { tenantId: 'mercadozetta', product: 'product-1', author: 'buyer-1' },
      { rating: 5, comment: 'Excellent' },
      expect.objectContaining({
        upsert: true,
        returnDocument: 'after',
      }),
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'seller-1' }),
    );
  });

  it('rejects reviews without a matching purchase', async () => {
    vi.mocked(Product.findOne).mockResolvedValue({
      seller: 'seller-1',
    } as never);
    vi.mocked(Order.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(OrderItem.exists).mockResolvedValue(null);
    await expect(
      createReview('buyer-1', 'mercadozetta', 'product-1', 5, 'Great'),
    ).rejects.toMatchObject({ code: 'REVIEW_PURCHASE_REQUIRED' });
  });
});
