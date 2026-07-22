import AppError from '@/errors/AppError';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { checkedMoneyAdd, checkedMoneyMultiply, moneyFromMinor } from '@/money';
import { resolveTenant } from '@/tenants';
import type { CartRepository } from '@/repositories/cartRepository';
import type { DeliveryAddressRepository } from '@/repositories/deliveryAddressRepository';
import { calculateCheckoutQuote } from '@/services/checkoutPricing';
import {
  deterministicDeliveryQuoteProvider,
  type DeliveryQuoteProvider,
} from '@/services/deliveryOptions';
import type {
  CheckoutOrderRequest,
  CheckoutSelection,
} from '@/validators/deliveryValidator';

async function createOrderInTransaction(
  transactions: CheckoutTransactionCoordinator,
  userId: string,
  tenantId: string,
  idempotencyKey: string,
  selection?: CheckoutOrderRequest,
  deliveryQuotes: DeliveryQuoteProvider = deterministicDeliveryQuoteProvider,
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
    let pricing = {
      currency: tenant.currencyCode,
      currencyMinorUnit: tenant.currencyMinorUnit,
      subtotalMinor,
      discountMinor: 0n,
      shippingMinor: 0n,
      totalMinor: subtotalMinor,
    };

    let deliveryAddress;
    let deliveryOption;
    if (selection) {
      const address = await repositories.addresses.findByIdForUpdate(
        tenantId,
        userId,
        selection.addressId,
      );
      if (!address)
        throw new AppError(
          404,
          'DELIVERY_ADDRESS_NOT_FOUND',
          'Delivery address not found',
        );
      const selectedQuote = calculateCheckoutQuote(
        cart.items.map((item) => ({
          product: productMap.get(item.productId)!,
          quantity: item.quantity,
        })),
        address,
        selection.deliveryOptionId,
        tenant.currencyCode,
        deliveryQuotes,
      );
      if (selectedQuote.quoteId !== selection.quoteId)
        throw new AppError(
          409,
          'CHECKOUT_QUOTE_CHANGED',
          'Cart price, availability, address, or delivery quote changed',
        );
      pricing = {
        ...selectedQuote.pricing,
        currencyMinorUnit: tenant.currencyMinorUnit,
      };
      deliveryAddress = {
        sourceAddressId: address._id,
        label: address.label,
        recipientName: address.recipientName,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
        telephone: address.telephone,
      };
      deliveryOption = {
        id: selectedQuote.deliveryOption.id,
        label: selectedQuote.deliveryOption.label,
        estimate: selectedQuote.deliveryOption.estimate,
      };
    }

    const order =
      deliveryAddress && deliveryOption
        ? await repositories.orders.createPlaced(
            tenantId,
            userId,
            idempotencyKey,
            pricing,
            now,
            deliveryAddress,
            deliveryOption,
          )
        : await repositories.orders.createPlaced(
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
  carts?: CartRepository,
  addresses?: DeliveryAddressRepository,
  deliveryQuotes: DeliveryQuoteProvider = deterministicDeliveryQuoteProvider,
) {
  return {
    getCheckoutQuote: async (
      userId: string,
      tenantId: string,
      selection: CheckoutSelection,
    ) => {
      if (!carts || !addresses)
        throw new Error('Checkout quote repositories missing');
      const [cart, address] = await Promise.all([
        carts.get(tenantId, userId),
        addresses.findById(tenantId, userId, selection.addressId),
      ]);
      if (!address)
        throw new AppError(
          404,
          'DELIVERY_ADDRESS_NOT_FOUND',
          'Delivery address not found',
        );
      const tenant = resolveTenant(tenantId);
      if (!tenant) throw new Error('Checkout tenant is missing');
      return calculateCheckoutQuote(
        cart?.items ?? [],
        address,
        selection.deliveryOptionId,
        tenant.currencyCode,
        deliveryQuotes,
      ).response;
    },
    createOrder: (
      userId: string,
      tenantId: string,
      idempotencyKey: string,
      selection?: CheckoutOrderRequest,
    ) =>
      createOrderInTransaction(
        transactions,
        userId,
        tenantId,
        idempotencyKey,
        selection,
        deliveryQuotes,
      ),
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
