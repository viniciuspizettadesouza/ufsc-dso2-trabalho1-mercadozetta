import type { components } from '@/contracts/api';
import { withPage } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Order = components['schemas']['Order'];
export type OrderStatus = components['schemas']['OrderStatus'];
export type OrderList = components['schemas']['OrderList'];
export type OrderStatusInput =
  components['schemas']['OrderStatusUpdateRequest'];
export type OrderListRequest = {
  userId: string;
  scope: 'buyer' | 'seller';
  limit: number | null;
  offset: number | null;
};

export async function listOrders(
  request: OrderListRequest,
): Promise<OrderList> {
  const response = await api.get<OrderList>(orderListPath(request));
  return response.data;
}

export async function createOrder(): Promise<Order> {
  const response = await api.post<Order>(apiRoutes.orders);
  return response.data;
}

export async function updateOrderStatus(
  orderId: string,
  input: OrderStatusInput,
): Promise<Order> {
  const response = await api.patch<Order>(
    apiRoutes.orderStatus(orderId),
    input,
  );
  return response.data;
}

function orderListPath(request: OrderListRequest) {
  const path = `${apiRoutes.orders}?scope=${request.scope}`;
  return request.limit === null || request.offset === null
    ? path
    : withPage(path, request.offset, request.limit);
}
