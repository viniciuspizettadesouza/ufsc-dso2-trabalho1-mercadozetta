import { describe, expect, it, vi } from 'vitest';

import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { createDeliveryAddressService } from '@/services/deliveryAddressService';

const now = new Date('2026-07-22T10:00:00.000Z');
const tenantId = 'campus-market';
const userId = '507f191e-810c-4197-9de8-60ea00000001';
const data = {
  label: 'Home',
  recipientName: 'Buyer',
  line1: 'Rua do Mercado 1',
  line2: null,
  city: 'Lisboa',
  region: 'Lisboa',
  postalCode: '1000-001',
  countryCode: 'PT',
  telephone: '+351210000000',
  isDefault: false,
};
const address = {
  _id: '507f191e-810c-4197-9de8-60ea00000002',
  tenantId,
  userId,
  ...data,
  isDefault: true,
  createdAt: now,
  updatedAt: now,
};

function harness(overrides: Record<string, unknown> = {}) {
  const addresses = {
    list: vi.fn().mockResolvedValue([address]),
    count: vi.fn().mockResolvedValue(0),
    findByIdForUpdate: vi.fn().mockResolvedValue(address),
    create: vi.fn().mockResolvedValue(address),
    update: vi.fn().mockResolvedValue(address),
    delete: vi.fn().mockResolvedValue(true),
    unsetDefault: vi.fn().mockResolvedValue(undefined),
    promoteMostRecent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const transactions = {
    run: vi.fn((work) => work({ addresses } as never)),
  } as unknown as CheckoutTransactionCoordinator;
  return {
    ...createDeliveryAddressService(addresses as never, transactions),
    addresses,
  };
}

describe('deliveryAddressService', () => {
  it('makes the first saved address the default atomically', async () => {
    const test = harness();

    await expect(test.create(tenantId, userId, data)).resolves.toEqual(address);

    expect(test.addresses.unsetDefault).toHaveBeenCalledWith(tenantId, userId);
    expect(test.addresses.create).toHaveBeenCalledWith(
      tenantId,
      userId,
      { ...data, isDefault: true },
      expect.any(Date),
    );
  });

  it('keeps the current default unless another address is explicitly promoted', async () => {
    const test = harness();

    await test.update(tenantId, userId, address._id, data);

    expect(test.addresses.unsetDefault).not.toHaveBeenCalled();
    expect(test.addresses.update).toHaveBeenCalledWith(
      tenantId,
      userId,
      address._id,
      { ...data, isDefault: true },
      expect.any(Date),
    );
  });

  it('promotes a replacement after deleting the default', async () => {
    const test = harness();

    await test.delete(tenantId, userId, address._id);

    expect(test.addresses.promoteMostRecent).toHaveBeenCalledWith(
      tenantId,
      userId,
      expect.any(Date),
    );
  });

  it('does not expose another tenant or user address', async () => {
    const test = harness({
      findByIdForUpdate: vi.fn().mockResolvedValue(null),
    });

    await expect(
      test.delete(tenantId, userId, address._id),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'DELIVERY_ADDRESS_NOT_FOUND',
    });
    expect(test.addresses.delete).not.toHaveBeenCalled();
  });
});
