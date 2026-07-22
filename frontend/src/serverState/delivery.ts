import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/serverState/queryKeys';
import {
  createDeliveryAddress,
  deleteDeliveryAddress,
  getCheckoutQuote,
  listDeliveryAddresses,
  updateDeliveryAddress,
  type CheckoutSelection,
  type DeliveryAddressInput,
} from '@/services/delivery';

export function useDeliveryAddresses(userId: string) {
  return useQuery({
    queryKey: queryKeys.addresses.list(userId),
    queryFn: listDeliveryAddresses,
  });
}

function useAddressMutation(userId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.addresses.list(userId),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.checkout.all });
  };
}

export function useCreateDeliveryAddress(userId: string) {
  const onSuccess = useAddressMutation(userId);
  return useMutation({ mutationFn: createDeliveryAddress, onSuccess });
}

export function useUpdateDeliveryAddress(userId: string) {
  const onSuccess = useAddressMutation(userId);
  return useMutation({
    mutationFn: ({
      addressId,
      input,
    }: {
      addressId: string;
      input: DeliveryAddressInput;
    }) => updateDeliveryAddress(addressId, input),
    onSuccess,
  });
}

export function useDeleteDeliveryAddress(userId: string) {
  const onSuccess = useAddressMutation(userId);
  return useMutation({ mutationFn: deleteDeliveryAddress, onSuccess });
}

export function useCheckoutQuote(
  userId: string,
  selection: CheckoutSelection | null,
) {
  return useQuery({
    queryKey: queryKeys.checkout.quote(
      userId,
      selection?.addressId ?? '',
      selection?.deliveryOptionId ?? '',
    ),
    queryFn: () => getCheckoutQuote(selection!),
    enabled: Boolean(selection),
  });
}
