import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type { ProductRecord } from '@/repositories/productRepository';
import { createCheckoutService } from '@/services/checkoutService';

const now = new Date('2026-07-19T15:00:00.000Z');
const tenantId = 'mercadozetta';
const buyerId = '507f1f77-bcf8-4ecd-8994-390110000001';
const sellerId = '507f1f77-bcf8-4ecd-8994-390110000002';
const idempotencyKey = '507f191e-810c-4197-9de8-60ea00000005';
const address = {
  _id: '507f191e-810c-4197-9de8-60ea00000006',
  tenantId,
  userId: buyerId,
  label: 'Home',
  recipientName: 'Buyer',
  line1: '1 Market Street',
  line2: null,
  city: 'Lisbon',
  region: 'Lisbon',
  postalCode: '1000-001',
  countryCode: 'PT',
  telephone: '+351210000000',
  isDefault: true,
  createdAt: now,
  updatedAt: now,
};
const cart = {
  id: '507f191e-810c-4197-9de8-60ea00000001',
  tenantId,
  buyerId,
  items: [
    {
      productId: '507f191e-810c-4197-9de8-60ea00000002',
      quantity: 2,
    },
    {
      productId: '507f191e-810c-4197-9de8-60ea00000003',
      quantity: 1,
    },
  ],
};
const products: ProductRecord[] = [
  {
    _id: cart.items[0].productId,
    tenantId,
    seller: sellerId,
    name: 'Keyboard',
    inventory: 5,
    price: { currency: 'USD', amountMinor: '1000' },
    status: 'active',
  },
  {
    _id: cart.items[1].productId,
    tenantId,
    seller: sellerId,
    name: 'Mouse',
    inventory: 3,
    price: { currency: 'USD', amountMinor: '2000' },
    status: 'active',
  },
];
const order = {
  _id: '507f191e-810c-4197-9de8-60ea00000004',
  tenantId,
  buyer: buyerId,
  status: 'placed' as const,
  pricingState: 'priced' as const,
  subtotal: { currency: 'USD', amountMinor: '4000' },
  discount: { currency: 'USD', amountMinor: '0' },
  shipping: { currency: 'USD', amountMinor: '0' },
  total: { currency: 'USD', amountMinor: '4000' },
  statusHistory: [
    {
      status: 'placed' as const,
      actor: buyerId,
      changedAt: now,
    },
  ],
  createdAt: now,
  updatedAt: now,
};

function harness(
  overrides: {
    cart?: typeof cart | null;
    products?: ProductRecord[];
    inventoryUpdated?: boolean;
    replayedOrder?: typeof order | null;
  } = {},
) {
  const checkoutCart = overrides.cart === undefined ? cart : overrides.cart;
  const carts = {
    get: vi.fn().mockResolvedValue(
      checkoutCart
        ? {
            tenantId,
            buyer: buyerId,
            items: checkoutCart.items.map((item) => ({
              product: (overrides.products ?? products).find(
                (product) => product._id === item.productId,
              )!,
              quantity: item.quantity,
            })),
          }
        : null,
    ),
    findForCheckout: vi.fn().mockResolvedValue(checkoutCart),
    clear: vi.fn().mockResolvedValue(undefined),
  };

  const productRepository = {
    findByIdsForUpdate: vi
      .fn()
      .mockResolvedValue(overrides.products ?? products),
    decrementAvailableInventory: vi
      .fn()
      .mockResolvedValue(overrides.inventoryUpdated ?? true),
  };
  const orders = {
    createPlaced: vi.fn().mockResolvedValue(order),
    findByCheckoutIdempotencyKey: vi
      .fn()
      .mockResolvedValue(overrides.replayedOrder ?? null),
  };
  const orderItems = {
    createMany: vi.fn().mockResolvedValue([]),
    listByOrderIds: vi.fn().mockResolvedValue([]),
  };
  const audits = { appendMany: vi.fn().mockResolvedValue(undefined) };
  const notifications = {
    create: vi.fn().mockResolvedValue(undefined),
    createMany: vi.fn().mockResolvedValue(undefined),
  };
  const addresses = {
    findById: vi.fn().mockResolvedValue(address),
    findByIdForUpdate: vi.fn().mockResolvedValue(address),
  };
  const repositories = {
    addresses,
    carts,
    products: productRepository,
    orders,
    orderItems,
    audits,
    notifications,
  };
  const transactions = {
    run: vi.fn((work) => work(repositories as never)),
  } as unknown as CheckoutTransactionCoordinator;

  return {
    ...createCheckoutService(transactions, carts as never, addresses as never),
    transactions,
    carts,
    products: productRepository,
    orders,
    orderItems,
    audits,
    notifications,
    addresses,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkoutService', () => {
  it('places the complete order and all side effects in one transaction', async () => {
    const test = harness();

    const created = await test.createOrder(buyerId, tenantId, idempotencyKey);

    expect(test.transactions.run).toHaveBeenCalledTimes(1);
    expect(test.carts.findForCheckout).toHaveBeenCalledWith(tenantId, buyerId);
    expect(test.products.findByIdsForUpdate).toHaveBeenCalledWith(
      tenantId,
      cart.items.map((item) => item.productId),
    );
    expect(test.orders.createPlaced).toHaveBeenCalledWith(
      tenantId,
      buyerId,
      idempotencyKey,
      {
        currency: 'USD',
        currencyMinorUnit: 2,
        subtotalMinor: 4000n,
        discountMinor: 0n,
        shippingMinor: 0n,
        totalMinor: 4000n,
      },
      now,
    );

    const expectedItems = [
      {
        tenantId,
        order: order._id,
        product: products[0]._id,
        seller: sellerId,
        productName: products[0].name,
        quantity: 2,
        pricingState: 'priced' as const,
        unitPrice: { currency: 'USD', amountMinor: '1000' },
        lineSubtotal: { currency: 'USD', amountMinor: '2000' },
      },
      {
        tenantId,
        order: order._id,
        product: products[1]._id,
        seller: sellerId,
        productName: products[1].name,
        quantity: 1,
        pricingState: 'priced',
        unitPrice: { currency: 'USD', amountMinor: '2000' },
        lineSubtotal: { currency: 'USD', amountMinor: '2000' },
      },
    ];
    expect(test.orderItems.createMany).toHaveBeenCalledWith(expectedItems, now);
    expect(test.products.decrementAvailableInventory.mock.calls).toEqual([
      [tenantId, products[0]._id, 2],
      [tenantId, products[1]._id, 1],
    ]);
    expect(test.audits.appendMany).toHaveBeenCalledWith([
      {
        tenantId,
        eventType: 'order.placed',
        actorId: buyerId,
        resourceType: 'order',
        resourceId: order._id,
        metadata: { itemCount: 2 },
        occurredAt: now,
      },
      {
        tenantId,
        eventType: 'inventory.decremented',
        actorId: buyerId,
        resourceType: 'product',
        resourceId: products[0]._id,
        metadata: {
          orderId: order._id,
          quantity: 2,
          previousInventory: 5,
          nextInventory: 3,
        },
        occurredAt: now,
      },
      {
        tenantId,
        eventType: 'inventory.decremented',
        actorId: buyerId,
        resourceType: 'product',
        resourceId: products[1]._id,
        metadata: {
          orderId: order._id,
          quantity: 1,
          previousInventory: 3,
          nextInventory: 2,
        },
        occurredAt: now,
      },
    ]);
    expect(test.carts.clear).toHaveBeenCalledWith(tenantId, cart.id);
    expect(test.notifications.create).toHaveBeenCalledWith(
      {
        tenantId,
        userId: buyerId,
        message: `Order ${order._id} created`,
      },
      now,
    );
    expect(test.notifications.createMany).toHaveBeenCalledWith(
      [
        {
          tenantId,
          userId: sellerId,
          message: `New order ${order._id}`,
        },
      ],
      now,
    );
    expect(created).toEqual({ ...order, items: expectedItems });
  });

  it('returns the original order for a repeated idempotency key without side effects', async () => {
    const replayedItems = [
      {
        tenantId,
        order: order._id,
        product: products[0]._id,
        seller: sellerId,
        productName: products[0].name,
        quantity: 2,
        pricingState: 'priced' as const,
        unitPrice: { currency: 'USD', amountMinor: '1000' },
        lineSubtotal: { currency: 'USD', amountMinor: '2000' },
      },
    ];
    const test = harness({ replayedOrder: order });
    test.orderItems.listByOrderIds.mockResolvedValue(replayedItems);

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey),
    ).resolves.toEqual({ ...order, items: replayedItems });

    expect(test.carts.findForCheckout).toHaveBeenCalledWith(tenantId, buyerId);
    expect(test.orders.findByCheckoutIdempotencyKey).toHaveBeenCalledWith(
      tenantId,
      buyerId,
      idempotencyKey,
    );
    expect(test.orderItems.listByOrderIds).toHaveBeenCalledWith(tenantId, [
      order._id,
    ]);
    expect(test.products.findByIdsForUpdate).not.toHaveBeenCalled();
    expect(test.orders.createPlaced).not.toHaveBeenCalled();
    expect(test.audits.appendMany).not.toHaveBeenCalled();
    expect(test.carts.clear).not.toHaveBeenCalled();
    expect(test.notifications.create).not.toHaveBeenCalled();
  });

  it('quotes and snapshots selected delivery with authoritative shipping', async () => {
    const test = harness();
    const quote = await test.getCheckoutQuote(buyerId, tenantId, {
      addressId: address._id,
      deliveryOptionId: 'standard',
    });

    expect(quote).toMatchObject({
      address,
      shipping: { currency: 'USD', amountMinor: '499' },
      subtotal: { currency: 'USD', amountMinor: '4000' },
      discount: { currency: 'USD', amountMinor: '0' },
      total: { currency: 'USD', amountMinor: '4499' },
    });

    await test.createOrder(buyerId, tenantId, idempotencyKey, {
      addressId: address._id,
      deliveryOptionId: 'standard',
      quoteId: quote.quoteId,
    });

    expect(test.orders.createPlaced).toHaveBeenCalledWith(
      tenantId,
      buyerId,
      idempotencyKey,
      {
        currency: 'USD',
        currencyMinorUnit: 2,
        subtotalMinor: 4000n,
        discountMinor: 0n,
        shippingMinor: 499n,
        totalMinor: 4499n,
      },
      now,
      {
        sourceAddressId: address._id,
        label: address.label,
        recipientName: address.recipientName,
        line1: address.line1,
        line2: null,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
        telephone: address.telephone,
      },
      {
        id: 'standard',
        label: 'Standard demo delivery',
        estimate: '3–5 business days (demo estimate)',
      },
    );
  });

  it('preserves the cart when the submitted quote is stale', async () => {
    const test = harness();

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey, {
        addressId: address._id,
        deliveryOptionId: 'express',
        quoteId: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CHECKOUT_QUOTE_CHANGED',
    });

    expect(test.orders.createPlaced).not.toHaveBeenCalled();
    expect(test.carts.clear).not.toHaveBeenCalled();
    expect(test.products.decrementAvailableInventory).not.toHaveBeenCalled();
  });

  it('rejects an empty cart before loading products', async () => {
    const test = harness({ cart: null });

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'EMPTY_CART',
    });
    expect(test.products.findByIdsForUpdate).not.toHaveBeenCalled();
    expect(test.orders.createPlaced).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', []],
    ['inactive', [{ ...products[0], status: 'paused' as const }]],
    ['understocked', [{ ...products[0], inventory: 1 }]],
  ])('rejects a %s cart product before creating an order', async (_, found) => {
    const oneItemCart = { ...cart, items: [cart.items[0]] };
    const test = harness({ cart: oneItemCart, products: found });

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INSUFFICIENT_INVENTORY',
    });
    expect(test.orders.createPlaced).not.toHaveBeenCalled();
  });

  it('rejects an unpriced locked product before creating an order', async () => {
    const test = harness({
      cart: { ...cart, items: [cart.items[0]] },
      products: [{ ...products[0], price: null }],
    });

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PRODUCT_PRICE_REQUIRED',
    });
    expect(test.orders.createPlaced).not.toHaveBeenCalled();
  });

  it('rejects a line amount above the supported exact-money bound', async () => {
    const test = harness({
      cart: { ...cart, items: [cart.items[0]] },
      products: [
        {
          ...products[0],
          price: { currency: 'USD', amountMinor: '9000000000000000' },
        },
      ],
    });

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ORDER_TOTAL_LIMIT_EXCEEDED',
    });
    expect(test.orders.createPlaced).not.toHaveBeenCalled();
  });

  it('rejects a lost conditional inventory update before side effects', async () => {
    const test = harness({ inventoryUpdated: false });

    await expect(
      test.createOrder(buyerId, tenantId, idempotencyKey),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INSUFFICIENT_INVENTORY',
    });
    expect(test.audits.appendMany).not.toHaveBeenCalled();
    expect(test.carts.clear).not.toHaveBeenCalled();
    expect(test.notifications.create).not.toHaveBeenCalled();
    expect(test.notifications.createMany).not.toHaveBeenCalled();
  });
});
