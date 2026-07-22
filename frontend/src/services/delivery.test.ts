import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  createDeliveryAddress,
  deleteDeliveryAddress,
  getCheckoutQuote,
  listDeliveryAddresses,
  updateDeliveryAddress,
} from '@/services/delivery';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const address = {
  _id: '507f191e-810c-4197-9de8-60ea00000001',
  label: 'Home',
};
const input = {
  label: 'Home',
  recipientName: 'Buyer',
  line1: '1 Market Street',
  city: 'Lisbon',
  postalCode: '1000-001',
  countryCode: 'PT',
  telephone: '+351210000000',
  isDefault: true,
};

describe('delivery service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the address CRUD contract', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [address] });
    vi.mocked(api.post).mockResolvedValue({ data: address });
    vi.mocked(api.put).mockResolvedValue({ data: address });
    vi.mocked(api.delete).mockResolvedValue({});

    await expect(listDeliveryAddresses()).resolves.toEqual([address]);
    await expect(createDeliveryAddress(input)).resolves.toBe(address);
    await expect(updateDeliveryAddress(address._id, input)).resolves.toBe(
      address,
    );
    await deleteDeliveryAddress(address._id);

    expect(api.get).toHaveBeenCalledWith('/account/addresses');
    expect(api.post).toHaveBeenCalledWith('/account/addresses', input);
    expect(api.put).toHaveBeenCalledWith(
      `/account/addresses/${address._id}`,
      input,
    );
    expect(api.delete).toHaveBeenCalledWith(
      `/account/addresses/${address._id}`,
    );
  });

  it('requests an authoritative checkout quote', async () => {
    const selection = {
      addressId: address._id,
      deliveryOptionId: 'standard' as const,
    };
    const quote = { quoteId: 'a'.repeat(64) };
    vi.mocked(api.post).mockResolvedValue({ data: quote });

    await expect(getCheckoutQuote(selection)).resolves.toBe(quote);
    expect(api.post).toHaveBeenCalledWith('/checkout/quote', selection);
  });
});
