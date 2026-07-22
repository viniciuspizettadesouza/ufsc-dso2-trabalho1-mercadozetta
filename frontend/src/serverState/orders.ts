import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { CartItem } from '@/serverState/cart';
import { queryKeys, type OrderListRequest } from '@/serverState/queryKeys';
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  type OrderList,
  type OrderStatusInput,
} from '@/services/orders';
import type { CheckoutOrderInput } from '@/services/delivery';

export type { Order, OrderStatus } from '@/services/orders';
type OrderStatusMutation = OrderStatusInput & { orderId: string };
export type OrderQueryData = OrderList;

export const orderQueries = {
  list: (request: OrderListRequest) =>
    queryOptions({
      queryKey: queryKeys.orders.list(request),
      queryFn: () => listOrders(request),
    }),
};

export function useOrderList(request: OrderListRequest, enabled = true) {
  return useQuery({
    ...orderQueries.list(request),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrder(userId: string, request: OrderListRequest) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      idempotencyKey,
      input,
    }: {
      idempotencyKey: string;
      input: CheckoutOrderInput;
    }) => createOrder(idempotencyKey, input),
    onSuccess: (order) => {
      queryClient.setQueryData<OrderQueryData>(
        queryKeys.orders.list(request),
        (current) =>
          current
            ? {
                ...current,
                items: [
                  order,
                  ...current.items.filter((item) => item._id !== order._id),
                ],
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.all,
        refetchType: 'inactive',
      });
      queryClient.setQueryData<CartItem[]>(queryKeys.cart.items(userId), []);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cart.items(userId),
        refetchType: 'inactive',
      });
      queryClient.setQueryData<string[]>(queryKeys.cart.productIds(userId), []);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cart.productIds(userId),
        refetchType: 'inactive',
      });
    },
  });
}

export function useAdvanceOrder(request: OrderListRequest) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status }: OrderStatusMutation) =>
      updateOrderStatus(orderId, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData<OrderQueryData>(
        queryKeys.orders.list(request),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((entry) =>
                  entry._id === updated._id ? updated : entry,
                ),
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.all,
        refetchType: 'inactive',
      });
    },
  });
}
