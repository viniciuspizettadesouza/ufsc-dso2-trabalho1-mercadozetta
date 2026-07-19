import { describe, expect, it, vi } from 'vitest';
import { PostgresAccountLifecycleRepository } from '@/repositories/postgres/accountLifecycleRepository';

function chain(result: unknown) {
  const query: Record<string, any> = {};
  for (const method of ['from', 'where', 'limit', 'set', 'returning'])
    query[method] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve(result));
  return query;
}

describe('PostgresAccountLifecycleRepository', () => {
  it('detects tenant-scoped active buyer or seller orders', async () => {
    const sellerSubquery = chain([]);
    const activeOrder = chain([{ id: 'order-1' }]);
    const database = {
      select: vi
        .fn()
        .mockReturnValueOnce(sellerSubquery)
        .mockReturnValueOnce(activeOrder),
    };
    const repository = new PostgresAccountLifecycleRepository(
      database as never,
    );

    await expect(
      repository.hasActiveOrders('mercadozetta', 'user-1'),
    ).resolves.toBe(true);
    expect(activeOrder.where).toHaveBeenCalledOnce();
    expect(activeOrder.limit).toHaveBeenCalledWith(1);

    const none = {
      select: vi
        .fn()
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([])),
    };
    await expect(
      new PostgresAccountLifecycleRepository(none as never).hasActiveOrders(
        'campus-market',
        'user-1',
      ),
    ).resolves.toBe(false);
  });

  it('archives only owned non-archived listings and reports the count', async () => {
    const update = chain([{ id: 'product-1' }, { id: 'product-2' }]);
    const repository = new PostgresAccountLifecycleRepository({
      update: vi.fn(() => update),
    } as never);
    const now = new Date('2026-07-19T15:00:00.000Z');

    await expect(
      repository.archiveOwnedListings('mercadozetta', 'seller-1', now),
    ).resolves.toBe(2);
    expect(update.set).toHaveBeenCalledWith({
      status: 'archived',
      updatedAt: now,
    });
    expect(update.where).toHaveBeenCalledOnce();
  });

  it('deletes cart, watchlist, and notification state with scoped counts', async () => {
    const cartDelete = chain([{ id: 'cart-1' }]);
    const watchlistDelete = chain([{ id: 'watch-1' }, { id: 'watch-2' }]);
    const notificationDelete = chain([{ id: 'notification-1' }]);
    const database = {
      delete: vi
        .fn()
        .mockReturnValueOnce(cartDelete)
        .mockReturnValueOnce(watchlistDelete)
        .mockReturnValueOnce(notificationDelete),
    };
    const repository = new PostgresAccountLifecycleRepository(
      database as never,
    );

    await expect(
      repository.deleteDisposableState('mercadozetta', 'user-1'),
    ).resolves.toEqual({
      carts: 1,
      watchlistEntries: 2,
      notifications: 1,
    });
    expect(database.delete).toHaveBeenCalledTimes(3);
    expect(cartDelete.where).toHaveBeenCalledOnce();
    expect(watchlistDelete.where).toHaveBeenCalledOnce();
    expect(notificationDelete.where).toHaveBeenCalledOnce();
  });
});
