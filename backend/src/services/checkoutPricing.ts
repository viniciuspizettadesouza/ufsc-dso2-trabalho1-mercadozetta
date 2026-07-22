import { createHash } from 'node:crypto';

import AppError from '@/errors/AppError';
import { checkedMoneyAdd, checkedMoneyMultiply, moneyFromMinor } from '@/money';
import type { DeliveryAddress } from '@/repositories/deliveryAddressRepository';
import type { ProductRecord } from '@/repositories/productRepository';
import {
  deterministicDeliveryQuoteProvider,
  type DeliveryQuoteProvider,
} from '@/services/deliveryOptions';

type PricedCartItem = { product: ProductRecord; quantity: number };

export function calculateCheckoutQuote(
  items: PricedCartItem[],
  address: DeliveryAddress,
  deliveryOptionId: string,
  currency: string,
  deliveryQuotes: DeliveryQuoteProvider = deterministicDeliveryQuoteProvider,
) {
  if (!items.length) throw new AppError(400, 'EMPTY_CART', 'Cart is empty');
  let subtotalMinor = 0n;
  const pricedItems = items.map((item) => {
    if (
      item.product.status !== 'active' ||
      (item.product.inventory ?? 0) < item.quantity
    )
      throw new AppError(
        409,
        'INSUFFICIENT_INVENTORY',
        'A cart item is unavailable',
      );
    if (!item.product.price)
      throw new AppError(
        409,
        'PRODUCT_PRICE_REQUIRED',
        'A cart item has no current price',
      );
    if (item.product.price.currency !== currency)
      throw new Error('Product currency does not match its tenant');
    const unitPriceMinor = BigInt(item.product.price.amountMinor);
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
    return { ...item, unitPriceMinor, lineSubtotalMinor };
  });
  const deliveryOption = deliveryQuotes.getOption(deliveryOptionId, currency);
  const totalMinor = checkedMoneyAdd(
    subtotalMinor,
    deliveryOption.shippingMinor,
  );
  if (totalMinor === null)
    throw new AppError(
      409,
      'ORDER_TOTAL_LIMIT_EXCEEDED',
      'Order amount exceeds the supported limit',
    );
  const discountMinor = 0n;
  const fingerprint = {
    address: {
      id: address._id,
      updatedAt: address.updatedAt.toISOString(),
      postalCode: address.postalCode,
      countryCode: address.countryCode,
    },
    deliveryOptionId,
    items: pricedItems
      .map(({ product, quantity, unitPriceMinor }) => ({
        productId: product._id,
        quantity,
        unitPriceMinor: unitPriceMinor.toString(),
        inventory: product.inventory,
        status: product.status,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    currency,
    subtotalMinor: subtotalMinor.toString(),
    discountMinor: discountMinor.toString(),
    shippingMinor: deliveryOption.shippingMinor.toString(),
    totalMinor: totalMinor.toString(),
  };
  const quoteId = createHash('sha256')
    .update(JSON.stringify(fingerprint))
    .digest('hex');
  return {
    quoteId,
    address,
    deliveryOption,
    pricedItems,
    pricing: {
      currency,
      subtotalMinor,
      discountMinor,
      shippingMinor: deliveryOption.shippingMinor,
      totalMinor,
    },
    response: {
      quoteId,
      address,
      deliveryOption: {
        id: deliveryOption.id,
        label: deliveryOption.label,
        estimate: deliveryOption.estimate,
        shipping: deliveryOption.shipping,
      },
      subtotal: moneyFromMinor(currency, subtotalMinor),
      discount: moneyFromMinor(currency, discountMinor),
      shipping: deliveryOption.shipping,
      total: moneyFromMinor(currency, totalMinor),
    },
  };
}
