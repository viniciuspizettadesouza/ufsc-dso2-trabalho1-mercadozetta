import AppError from '@/errors/AppError';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { checkedMoneyAdd, checkedMoneyMultiply, moneyFromMinor } from '@/money';
import { resolveTenant } from '@/tenants';

async function createOrderInTransaction(
  transactions: CheckoutTransactionCoordinator,
  userId: string,
  tenantId: string,
  idempotencyKey: string,
) {
  return transactions.run(async (repositories) => {
    const now = new Date();
    const cart = await repositories.carts.findForCheckout(tenantId, userId);
    const replayedOrder =
      await repositories.orders.findByCheckoutIdempotencyKey(
        tenantId,
        userId,
        idempotencyKey,
      );
    if (replayedOrder) {
      const items = await repositories.orderItems.listByOrderIds(tenantId, [
        replayedOrder._id,
      ]);
      return { ...replayedOrder, items };
    }
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
      if (!product.price)
        throw new AppError(
          409,
          'PRODUCT_PRICE_REQUIRED',
          'A cart item has no current price',
        );
    }

    const tenant = resolveTenant(tenantId);
    if (!tenant) throw new Error('Checkout tenant is missing');
    let subtotalMinor = 0n;
    const pricedItems = cart.items.map((item) => {
      const product = productMap.get(item.productId)!;
      if (product.price!.currency !== tenant.currencyCode)
        throw new Error('Locked product currency does not match its tenant');
      const unitPriceMinor = BigInt(product.price!.amountMinor);
      const lineSubtotalMinor = checkedMoneyMultiply(
        unitPriceMinor,
        item.quantity,
      );
      if (lineSubtotalMinor === null)
        throw new AppError(
          409,
          'ORDER_TOTAL_LIMIT_EXCEEDED',
          'Order amount exceeds the supported limit',
        );
      const nextSubtotal = checkedMoneyAdd(subtotalMinor, lineSubtotalMinor);
      if (nextSubtotal === null)
        throw new AppError(
          409,
          'ORDER_TOTAL_LIMIT_EXCEEDED',
          'Order amount exceeds the supported limit',
        );
      subtotalMinor = nextSubtotal;
      return { item, product, unitPriceMinor, lineSubtotalMinor };
    });
    const pricing = {
      currency: tenant.currencyCode,
      currencyMinorUnit: tenant.currencyMinorUnit,
      subtotalMinor,
      discountMinor: 0n,
      shippingMinor: 0n,
      totalMinor: subtotalMinor,
    };

    const order = await repositories.orders.createPlaced(
      tenantId,
      userId,
      idempotencyKey,
      pricing,
      now,
    );
    const items = pricedItems.map(
      ({ item, product, unitPriceMinor, lineSubtotalMinor }) => {
        return {
          tenantId,
          order: order._id,
          product: product._id,
          seller: String(product.seller),
          productName: product.name,
          quantity: item.quantity,
          pricingState: 'priced' as const,
          unitPrice: moneyFromMinor(tenant.currencyCode, unitPriceMinor),
          lineSubtotal: moneyFromMinor(tenant.currencyCode, lineSubtotalMinor),
        };
      },
    );
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
    createOrder: (userId: string, tenantId: string, idempotencyKey: string) =>
      createOrderInTransaction(transactions, userId, tenantId, idempotencyKey),
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
