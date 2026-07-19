import AppError from '@/errors/AppError';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';

async function createOrderInTransaction(
  transactions: CheckoutTransactionCoordinator,
  userId: string,
  tenantId: string,
) {
  return transactions.run(async (repositories) => {
    const now = new Date();
    const cart = await repositories.carts.findForCheckout(tenantId, userId);
    if (!cart?.items.length)
      throw new AppError(400, 'EMPTY_CART', 'Cart is empty');

    const products = await repositories.products.findByIdsForUpdate(
      tenantId,
      cart.items.map((item) => item.productId),
    );
    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );
    for (const item of cart.items) {
      const product = productMap.get(item.productId);
      if (
        !product ||
        product.status !== 'active' ||
        product.inventory < item.quantity
      )
        throw new AppError(
          409,
          'INSUFFICIENT_INVENTORY',
          'A cart item is unavailable',
        );
    }

    const order = await repositories.orders.createPlaced(tenantId, userId, now);
    const items = cart.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        tenantId,
        order: order._id,
        product: product._id,
        seller: String(product.seller),
        productName: product.name,
        quantity: item.quantity,
      };
    });
    await repositories.orderItems.createMany(items, now);

    for (const item of items) {
      const inventoryUpdated =
        await repositories.products.decrementAvailableInventory(
          tenantId,
          String(item.product),
          item.quantity,
        );
      if (!inventoryUpdated)
        throw new AppError(
          409,
          'INSUFFICIENT_INVENTORY',
          'A cart item is unavailable',
        );
    }

    await repositories.audits.appendMany([
      {
        tenantId,
        eventType: 'order.placed',
        actorId: userId,
        resourceType: 'order',
        resourceId: order._id,
        metadata: { itemCount: items.length },
        occurredAt: now,
      },
      ...items.map((item) => {
        const product = productMap.get(String(item.product))!;
        return {
          tenantId,
          eventType: 'inventory.decremented' as const,
          actorId: userId,
          resourceType: 'product' as const,
          resourceId: String(item.product),
          metadata: {
            orderId: order._id,
            quantity: item.quantity,
            previousInventory: product.inventory,
            nextInventory: product.inventory - item.quantity,
          },
          occurredAt: now,
        };
      }),
    ]);

    await repositories.carts.clear(tenantId, cart.id);
    await repositories.notifications.create(
      {
        tenantId,
        userId,
        message: `Order ${order._id} created`,
      },
      now,
    );
    await repositories.notifications.createMany(
      [...new Set(items.map((item) => item.seller))].map((seller) => ({
        tenantId,
        userId: seller,
        message: `New order ${order._id}`,
      })),
      now,
    );
    return { ...order, items };
  });
}

export function createCheckoutService(
  transactions: CheckoutTransactionCoordinator,
) {
  return {
    createOrder: (userId: string, tenantId: string) =>
      createOrderInTransaction(transactions, userId, tenantId),
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
