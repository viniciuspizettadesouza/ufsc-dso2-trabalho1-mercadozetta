import { describe, expect, it } from 'vitest';

import type { DeliveryAddress } from '@/repositories/deliveryAddressRepository';
import type { ProductRecord } from '@/repositories/productRepository';
import { calculateCheckoutQuote } from '@/services/checkoutPricing';

const address: DeliveryAddress = {
  _id: '507f191e-810c-4197-9de8-60ea00000001',
  tenantId: 'mercadozetta',
  userId: '507f191e-810c-4197-9de8-60ea00000002',
  label: 'Home',
  recipientName: 'Buyer',
  line1: '1 Market Street',
  line2: null,
  city: 'Lisbon',
  region: null,
  postalCode: '1000-001',
  countryCode: 'PT',
  telephone: '+351210000000',
  isDefault: true,
  createdAt: new Date('2026-07-22T10:00:00.000Z'),
  updatedAt: new Date('2026-07-22T10:00:00.000Z'),
};

function product(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    _id: '507f191e-810c-4197-9de8-60ea00000003',
    tenantId: 'mercadozetta',
    seller: '507f191e-810c-4197-9de8-60ea00000004',
    name: 'Product',
    inventory: 2,
    status: 'active',
    price: { currency: 'USD', amountMinor: '1000' },
    ...overrides,
  };
}

function expectCode(run: () => unknown, code: string) {
  expect(run).toThrow(expect.objectContaining({ code }));
}

describe('checkoutPricing', () => {
  it('rejects empty, unavailable, unpriced, and wrong-currency carts', () => {
    expectCode(
      () => calculateCheckoutQuote([], address, 'standard', 'USD'),
      'EMPTY_CART',
    );
    expectCode(
      () =>
        calculateCheckoutQuote(
          [{ product: product({ status: 'paused' }), quantity: 1 }],
          address,
          'standard',
          'USD',
        ),
      'INSUFFICIENT_INVENTORY',
    );
    expectCode(
      () =>
        calculateCheckoutQuote(
          [{ product: product({ inventory: 0 }), quantity: 1 }],
          address,
          'standard',
          'USD',
        ),
      'INSUFFICIENT_INVENTORY',
    );
    expectCode(
      () =>
        calculateCheckoutQuote(
          [{ product: product({ price: null }), quantity: 1 }],
          address,
          'standard',
          'USD',
        ),
      'PRODUCT_PRICE_REQUIRED',
    );
    expect(() =>
      calculateCheckoutQuote(
        [
          {
            product: product({ price: { currency: 'EUR', amountMinor: '1' } }),
            quantity: 1,
          },
        ],
        address,
        'standard',
        'USD',
      ),
    ).toThrow('Product currency does not match its tenant');
  });

  it('rejects line, subtotal, and shipping overflow', () => {
    expectCode(
      () =>
        calculateCheckoutQuote(
          [
            {
              product: product({
                price: { currency: 'USD', amountMinor: '9000000000000000' },
              }),
              quantity: 2,
            },
          ],
          address,
          'standard',
          'USD',
        ),
      'ORDER_TOTAL_LIMIT_EXCEEDED',
    );
    expectCode(
      () =>
        calculateCheckoutQuote(
          [
            {
              product: product({
                _id: '507f191e-810c-4197-9de8-60ea00000005',
                price: { currency: 'USD', amountMinor: '5000000000000000' },
              }),
              quantity: 1,
            },
            {
              product: product({
                _id: '507f191e-810c-4197-9de8-60ea00000006',
                price: { currency: 'USD', amountMinor: '5000000000000000' },
              }),
              quantity: 1,
            },
          ],
          address,
          'standard',
          'USD',
        ),
      'ORDER_TOTAL_LIMIT_EXCEEDED',
    );
    expectCode(
      () =>
        calculateCheckoutQuote(
          [
            {
              product: product({
                price: { currency: 'USD', amountMinor: '9000000000000000' },
              }),
              quantity: 1,
            },
          ],
          address,
          'standard',
          'USD',
        ),
      'ORDER_TOTAL_LIMIT_EXCEEDED',
    );
  });
});
