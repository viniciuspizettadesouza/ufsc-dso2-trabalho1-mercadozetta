import { describe, expect, it } from 'vitest';

import {
  deterministicDeliveryQuoteProvider,
  getDeliveryOption,
  listDeliveryOptions,
} from '@/services/deliveryOptions';

describe('deliveryOptions', () => {
  it('returns deterministic standard and express demo quotes', () => {
    expect(listDeliveryOptions('EUR')).toEqual([
      {
        id: 'standard',
        label: 'Standard demo delivery',
        estimate: '3–5 business days (demo estimate)',
        shipping: { currency: 'EUR', amountMinor: '499' },
        shippingMinor: 499n,
      },
      {
        id: 'express',
        label: 'Express demo delivery',
        estimate: '1–2 business days (demo estimate)',
        shipping: { currency: 'EUR', amountMinor: '999' },
        shippingMinor: 999n,
      },
    ]);
  });

  it('rejects options outside the supported contract', () => {
    expect(() => getDeliveryOption('overnight', 'EUR')).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'INVALID_DELIVERY_OPTION',
      }),
    );
  });

  it('exposes the demo implementation through the delivery-provider contract', () => {
    expect(
      deterministicDeliveryQuoteProvider.getOption('standard', 'USD'),
    ).toEqual(getDeliveryOption('standard', 'USD'));
    expect(deterministicDeliveryQuoteProvider.listOptions('USD')).toHaveLength(
      2,
    );
  });
});
