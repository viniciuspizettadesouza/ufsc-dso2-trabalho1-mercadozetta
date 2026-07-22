import AppError from '@/errors/AppError';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type { DeliveryAddressRepository } from '@/repositories/deliveryAddressRepository';
import type { DeliveryAddressData } from '@/validators/deliveryValidator';

const notFound = () =>
  new AppError(404, 'DELIVERY_ADDRESS_NOT_FOUND', 'Delivery address not found');

export function createDeliveryAddressService(
  addresses: DeliveryAddressRepository,
  transactions: CheckoutTransactionCoordinator,
) {
  return {
    list: (tenantId: string, userId: string) =>
      addresses.list(tenantId, userId),

    create: (tenantId: string, userId: string, data: DeliveryAddressData) =>
      transactions.run(async ({ addresses: transactionAddresses }) => {
        const isDefault =
          data.isDefault ||
          (await transactionAddresses.count(tenantId, userId)) === 0;
        if (isDefault)
          await transactionAddresses.unsetDefault(tenantId, userId);
        return transactionAddresses.create(
          tenantId,
          userId,
          { ...data, isDefault },
          new Date(),
        );
      }),

    update: (
      tenantId: string,
      userId: string,
      addressId: string,
      data: DeliveryAddressData,
    ) =>
      transactions.run(async ({ addresses: transactionAddresses }) => {
        const current = await transactionAddresses.findByIdForUpdate(
          tenantId,
          userId,
          addressId,
        );
        if (!current) throw notFound();
        const isDefault = data.isDefault || current.isDefault;
        if (data.isDefault)
          await transactionAddresses.unsetDefault(tenantId, userId);
        const updated = await transactionAddresses.update(
          tenantId,
          userId,
          addressId,
          { ...data, isDefault },
          new Date(),
        );
        if (!updated) throw notFound();
        return updated;
      }),

    delete: (tenantId: string, userId: string, addressId: string) =>
      transactions.run(async ({ addresses: transactionAddresses }) => {
        const current = await transactionAddresses.findByIdForUpdate(
          tenantId,
          userId,
          addressId,
        );
        if (!current) throw notFound();
        if (!(await transactionAddresses.delete(tenantId, userId, addressId)))
          throw notFound();
        if (current.isDefault)
          await transactionAddresses.promoteMostRecent(
            tenantId,
            userId,
            new Date(),
          );
      }),
  };
}

export type DeliveryAddressService = ReturnType<
  typeof createDeliveryAddressService
>;
