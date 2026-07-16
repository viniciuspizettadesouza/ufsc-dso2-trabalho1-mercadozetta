import type { CartRepository } from '@/repositories/cartRepository';
import type { NotificationRepository } from '@/repositories/notificationRepository';
import type { OrderItemRepository } from '@/repositories/orderItemRepository';
import type { OrderRepository } from '@/repositories/orderRepository';
import type { ProductRepository } from '@/repositories/productRepository';

export type CheckoutRepositories = {
  carts: CartRepository;
  notifications: NotificationRepository;
  orderItems: OrderItemRepository;
  orders: OrderRepository;
  products: ProductRepository;
};

export interface CheckoutTransactionCoordinator {
  run<T>(work: (repositories: CheckoutRepositories) => Promise<T>): Promise<T>;
}
