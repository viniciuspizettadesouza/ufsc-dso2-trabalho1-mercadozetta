import type { Database } from '@/database/postgres';
import { createAuthController } from '@/controller/authController';
import { createAccountSecurityController } from '@/controller/accountSecurityController';
import { createAccountManagementController } from '@/controller/accountManagementController';
import { createCommerceController } from '@/controller/commerceController';
import { createProductController } from '@/controller/productController';
import { createUserController } from '@/controller/userController';
import { createAuthMiddleware } from '@/middleware/auth';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import {
  PostgresCartRepository,
  PostgresCheckoutTransactionCoordinator,
  PostgresNotificationRepository,
  PostgresOrderItemRepository,
  PostgresOrderRepository,
} from '@/repositories/postgres/checkoutRepositories';
import {
  PostgresReviewRepository,
  PostgresWatchlistRepository,
} from '@/repositories/postgres/commerceRepositories';
import { PostgresProductRepository } from '@/repositories/postgres/productRepository';
import { PostgresSessionRepository } from '@/repositories/postgres/sessionRepository';
import { PostgresUserRepository } from '@/repositories/postgres/userRepository';
import type { AccountMessageSender } from '@/services/accountMessageSender';
import { createAccountSecurityService } from '@/services/accountSecurityService';
import { createAccountManagementService } from '@/services/accountManagementService';
import { createAccountDeactivationService } from '@/services/accountDeactivationService';
import { createEmailChangeService } from '@/services/emailChangeService';
import { createCheckoutService } from '@/services/checkoutService';
import type { CartRepository } from '@/repositories/cartRepository';
import type { NotificationRepository } from '@/repositories/notificationRepository';
import type { OrderItemRepository } from '@/repositories/orderItemRepository';
import type { OrderRepository } from '@/repositories/orderRepository';
import type { ProductRepository } from '@/repositories/productRepository';
import type { ReviewRepository } from '@/repositories/reviewRepository';
import type { SessionRepository } from '@/repositories/sessionRepository';
import type { UserRepository } from '@/repositories/userRepository';
import type { WatchlistRepository } from '@/repositories/watchlistRepository';
import { createAuthService } from '@/services/authService';
import {
  createCartCommerceService,
  createNotificationCommerceService,
  createOrderCommerceService,
  createReviewCommerceService,
  createWatchlistCommerceService,
} from '@/services/commerceService';
import { createProductService } from '@/services/productService';
import { createSessionService } from '@/services/sessionService';
import { createUserService } from '@/services/userService';

type PersistenceRepositories = {
  users: UserRepository;
  products: ProductRepository;
  sessions: SessionRepository;
  carts: CartRepository;
  orders: OrderRepository;
  orderItems: OrderItemRepository;
  notifications: NotificationRepository;
  watchlists: WatchlistRepository;
  reviews: ReviewRepository;
  checkout: CheckoutTransactionCoordinator;
};

function createComposition(
  repositories: PersistenceRepositories,
  accountMessageSender?: AccountMessageSender,
) {
  const users = createUserService(repositories.users);
  const products = createProductService(
    repositories.products,
    users,
    repositories.checkout,
  );
  const sessions = createSessionService(
    repositories.sessions,
    repositories.checkout,
  );
  const auth = createAuthService(repositories.users, sessions);
  const commerce = {
    ...createCartCommerceService(repositories.carts, repositories.products),
    ...createCheckoutService(repositories.checkout),
    ...createOrderCommerceService(
      repositories.orders,
      repositories.orderItems,
      repositories.notifications,
      repositories.checkout,
    ),
    ...createNotificationCommerceService(repositories.notifications),
    ...createWatchlistCommerceService(
      repositories.watchlists,
      repositories.products,
    ),
    ...createReviewCommerceService(
      repositories.reviews,
      repositories.products,
      repositories.notifications,
    ),
  };

  return {
    accountManagementController: createAccountManagementController(
      createAccountManagementService(repositories.checkout),
      createAccountDeactivationService(repositories.checkout),
      accountMessageSender
        ? createEmailChangeService(repositories.checkout, accountMessageSender)
        : undefined,
    ),
    accountSecurityController: createAccountSecurityController(
      accountMessageSender
        ? createAccountSecurityService(
            repositories.checkout,
            accountMessageSender,
          )
        : undefined,
    ),
    authController: createAuthController(auth, sessions),
    authMiddleware: createAuthMiddleware(
      repositories.users,
      repositories.sessions,
    ),
    commerceController: createCommerceController(commerce),
    productController: createProductController(products),
    userController: createUserController(users),
  };
}

export type ApplicationComposition = ReturnType<typeof createComposition>;

export function createPostgresComposition(
  db: Database,
  accountMessageSender?: AccountMessageSender,
): ApplicationComposition {
  const users = new PostgresUserRepository(db);
  const products = new PostgresProductRepository(db);
  const sessions = new PostgresSessionRepository(db);
  const notifications = new PostgresNotificationRepository(db);
  return createComposition(
    {
      users,
      products,
      sessions,
      carts: new PostgresCartRepository(db),
      orders: new PostgresOrderRepository(db),
      orderItems: new PostgresOrderItemRepository(db),
      notifications,
      watchlists: new PostgresWatchlistRepository(db),
      reviews: new PostgresReviewRepository(db),
      checkout: new PostgresCheckoutTransactionCoordinator(db),
    },
    accountMessageSender,
  );
}
