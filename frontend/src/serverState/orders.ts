import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { firstPage, pageInfo, pageItems, withPage } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';
import type { CartItem } from '@/serverState/cart';
import { queryKeys, type OrderListRequest } from '@/serverState/queryKeys';

export type OrderStatus =
  'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type OrderItem = {
  productName: string;
  quantity: number;
  seller?: string;
};
export type StatusHistoryEntry = {
  status: OrderStatus;
  actor: string;
  changedAt: string;
};
export type Order = {
  _id: string;
  status: OrderStatus;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
};
export type OrderQueryData = { items: Order[]; page: typeof firstPage };

export const orderQueries = {
  list: (request: OrderListRequest) =>
    queryOptions({
      queryKey: queryKeys.orders.list(request),
      queryFn: async () => {
        const basePath = `${apiRoutes.orders}?scope=${request.scope}`;
        const path =
          request.limit === null || request.offset === null
            ? basePath
            : withPage(basePath, request.offset, request.limit);
        const response = await api.get(path);
        const orders = pageItems<Order>(response.data);
        return {
          items:
            request.scope === 'seller'
              ? orders
                  .map((order) => ({
                    ...order,
                    items: order.items.filter(
                      (item) => item.seller === request.userId,
                    ),
                  }))
                  .filter((order) => order.items.length > 0)
              : orders,
          page: pageInfo<Order>(response.data),
        };
      },
    }),
};

export function useOrderList(request: OrderListRequest) {
  return useQuery({
    ...orderQueries.list(request),
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrder(userId: string, request: OrderListRequest) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post(apiRoutes.orders);
      return response.data as Order;
    },
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
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: OrderStatus;
    }) => {
      const response = await api.patch(apiRoutes.orderStatus(orderId), {
        status,
      });
      return response.data as Pick<Order, 'statusHistory'>;
    },
    onSuccess: (response, { orderId, status }) => {
      queryClient.setQueryData<OrderQueryData>(
        queryKeys.orders.list(request),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((entry) =>
                  entry._id === orderId
                    ? {
                        ...entry,
                        status,
                        statusHistory:
                          response.statusHistory ?? entry.statusHistory,
                      }
                    : entry,
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
