import { describe, expect, it } from 'vitest';

import {
  validateCheckoutOrderRequest,
  validateCheckoutSelection,
  validateDeliveryAddress,
} from '@/validators/deliveryValidator';

const validAddress = {
  label: ' Home ',
  recipientName: ' Buyer ',
  line1: ' Rua do Mercado 1 ',
  line2: '',
  city: ' Lisboa ',
  region: ' Lisboa ',
  postalCode: ' 1000-001 ',
  countryCode: ' pt ',
  telephone: ' +351 210 000 000 ',
  isDefault: true,
};

describe('deliveryValidator', () => {
  it('normalizes a Portuguese delivery address', () => {
    expect(validateDeliveryAddress(validAddress)).toEqual({
      label: 'Home',
      recipientName: 'Buyer',
      line1: 'Rua do Mercado 1',
      line2: null,
      city: 'Lisboa',
      region: 'Lisboa',
      postalCode: '1000-001',
      countryCode: 'PT',
      telephone: '+351 210 000 000',
      isDefault: true,
    });
  });

  it('validates country-specific postal syntax without claiming deliverability', () => {
    expect(() =>
      validateDeliveryAddress({ ...validAddress, postalCode: '1000' }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_POSTAL_CODE' }));
    expect(
      validateDeliveryAddress({
        ...validAddress,
        countryCode: 'US',
        postalCode: '02110-1234',
      }).postalCode,
    ).toBe('02110-1234');
  });

  it('rejects missing address fields and unknown checkout fields', () => {
    expect(() => validateDeliveryAddress({})).toThrow(
      expect.objectContaining({ code: 'MISSING_ADDRESS_FIELDS' }),
    );
    expect(() =>
      validateCheckoutSelection({
        addressId: '507f191e-810c-4197-9de8-60ea00000001',
        deliveryOptionId: 'standard',
        discountCode: 'UNSUPPORTED',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
  });

  it('requires a canonical quote fingerprint for order submission', () => {
    expect(
      validateCheckoutOrderRequest({
        addressId: '507f191e-810c-4197-9de8-60ea00000001',
        deliveryOptionId: 'express',
        quoteId: 'a'.repeat(64),
      }),
    ).toMatchObject({ deliveryOptionId: 'express' });
    expect(() =>
      validateCheckoutOrderRequest({
        addressId: '507f191e-810c-4197-9de8-60ea00000001',
        deliveryOptionId: 'express',
        quoteId: 'stale',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
  });
});
