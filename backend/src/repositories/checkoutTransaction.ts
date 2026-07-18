import type { CartRepository } from '@/repositories/cartRepository';
import type { NotificationRepository } from '@/repositories/notificationRepository';
import type { OrderItemRepository } from '@/repositories/orderItemRepository';
import type { OrderRepository } from '@/repositories/orderRepository';
import type { ProductRepository } from '@/repositories/productRepository';
import type { AuditEventRepository } from '@/repositories/auditEventRepository';
import type { SessionRepository } from '@/repositories/sessionRepository';
import type { UserRepository } from '@/repositories/userRepository';

export type CheckoutRepositories = {
  audits: AuditEventRepository;
  carts: CartRepository;
  notifications: NotificationRepository;
  orderItems: OrderItemRepository;
  orders: OrderRepository;
  products: ProductRepository;
};

export type MutationRepositories = CheckoutRepositories & {
  sessions: SessionRepository;
  users: UserRepository;
};

export interface CheckoutTransactionCoordinator {
  run<T>(work: (repositories: MutationRepositories) => Promise<T>): Promise<T>;
}
