import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type DeliveryAddress = components['schemas']['DeliveryAddress'];
export type DeliveryAddressInput =
  components['schemas']['DeliveryAddressRequest'];
export type CheckoutSelection = components['schemas']['CheckoutSelection'];
export type CheckoutQuote = components['schemas']['CheckoutQuote'];
export type CheckoutOrderInput = components['schemas']['CheckoutOrderRequest'];

export async function listDeliveryAddresses(): Promise<DeliveryAddress[]> {
  return (await api.get<DeliveryAddress[]>(apiRoutes.deliveryAddresses)).data;
}

export async function createDeliveryAddress(
  input: DeliveryAddressInput,
): Promise<DeliveryAddress> {
  return (await api.post<DeliveryAddress>(apiRoutes.deliveryAddresses, input))
    .data;
}

export async function updateDeliveryAddress(
  addressId: string,
  input: DeliveryAddressInput,
): Promise<DeliveryAddress> {
  return (
    await api.put<DeliveryAddress>(apiRoutes.deliveryAddress(addressId), input)
  ).data;
}

export async function deleteDeliveryAddress(addressId: string): Promise<void> {
  await api.delete(apiRoutes.deliveryAddress(addressId));
}

export async function getCheckoutQuote(
  input: CheckoutSelection,
): Promise<CheckoutQuote> {
  return (await api.post<CheckoutQuote>(apiRoutes.checkoutQuote, input)).data;
}
