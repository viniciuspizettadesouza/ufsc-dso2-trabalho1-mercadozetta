import AppError from '@/errors/AppError';
import {
  buyerCancellableStatuses,
  type OrderStatus,
  sellerOrderTransitions,
} from '@/orderStatus';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type { AuditEventRepository } from '@/repositories/auditEventRepository';
import type { CartRepository } from '@/repositories/cartRepository';
import type { NotificationRepository } from '@/repositories/notificationRepository';
import type { OrderItemRepository } from '@/repositories/orderItemRepository';
import type { OrderRepository } from '@/repositories/orderRepository';
import type { ProductRepository } from '@/repositories/productRepository';
import type { ReviewRepository } from '@/repositories/reviewRepository';
import type { WatchlistRepository } from '@/repositories/watchlistRepository';
import type { Pagination } from '@/pagination';
import type { CheckoutService } from '@/services/checkoutService';
import type { OrderListData } from '@/validators/commerceValidator';

async function getCartWithRepository(
  carts: CartRepository,
  userId: string,
  tenantId: string,
) {
  const cart = await carts.get(tenantId, userId);
  return cart ?? { tenantId, buyer: userId, items: [] };
}

async function setCartItemWithRepository(
  carts: CartRepository,
  productRepository: ProductRepository,
  userId: string,
  tenantId: string,
  productId: string,
  quantity: number,
) {
  const product = await productRepository.findActiveById(tenantId, productId);
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  if ((product.inventory ?? 0) < quantity)
    throw new AppError(
      409,
      'INSUFFICIENT_INVENTORY',
      'Insufficient product inventory',
    );

  await carts.setItem(tenantId, userId, product._id, quantity);
  return getCartWithRepository(carts, userId, tenantId);
}

async function removeCartItemWithRepository(
  carts: CartRepository,
  userId: string,
  tenantId: string,
  productId: string,
) {
  await carts.removeItem(tenantId, userId, productId);
  return getCartWithRepository(carts, userId, tenantId);
}

async function addWatchlistWithRepository(
  watchlists: WatchlistRepository,
  productRepository: ProductRepository,
  userId: string,
  tenantId: string,
  productId: string,
) {
  const product = await productRepository.findById(tenantId, productId);
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  const entry = await watchlists.add(tenantId, userId, productId, new Date());
  return { ...entry, product };
}

async function listOrdersWithRepositories(
  orderRepository: OrderRepository,
  orderItems: OrderItemRepository,
  userId: string,
  tenantId: string,
  pagination: OrderListData,
) {
  const result = await orderRepository.listVisible(
    tenantId,
    userId,
    pagination,
  );
  const orderIds = result.items.map((order) => order._id);
  const items = await orderItems.listByOrderIds(tenantId, orderIds);
  return {
    ...result,
    items: result.items.map((order) => ({
      ...order,
      items: items.filter(
        (item) =>
          item.order === order._id &&
          (pagination.scope !== 'seller' || item.seller === userId),
      ),
    })),
  };
}

async function updateOrderStatusWithRepositories(
  orderRepository: OrderRepository,
  orderItems: OrderItemRepository,
  notifications: NotificationRepository,
  audits: AuditEventRepository,
  userId: string,
  tenantId: string,
  orderId: string,
  status: OrderStatus,
) {
  const order = await orderRepository.findById(tenantId, orderId);
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  const sellerItem = await orderItems.sellerOwnsOrder(
    tenantId,
    orderId,
    userId,
  );
  const isBuyerCancellation =
    String(order.buyer) === userId && status === 'cancelled';
  if (!sellerItem && !isBuyerCancellation)
    throw new AppError(
      403,
      'ORDER_FORBIDDEN',
      'Not authorized to update this order',
    );
  const isValidSellerTransition =
    Boolean(sellerItem) && sellerOrderTransitions[order.status] === status;
  const isValidBuyerCancellation =
    isBuyerCancellation && buyerCancellableStatuses.includes(order.status);
  if (!isValidSellerTransition && !isValidBuyerCancellation)
    throw new AppError(
      409,
      'ORDER_STATUS_TRANSITION_INVALID',
      `Order cannot transition from ${order.status} to ${status}`,
    );
  const now = new Date();
  const updated = await orderRepository.updateStatus(
    tenantId,
    orderId,
    status,
    userId,
    now,
  );
  await notifications.create(
    {
      tenantId,
      userId: order.buyer,
      message: `Order ${order._id} is now ${status}`,
    },
    now,
  );
  await audits.append({
    tenantId,
    eventType: 'order.status_changed',
    actorId: userId,
    resourceType: 'order',
    resourceId: orderId,
    metadata: { previousStatus: order.status, nextStatus: status },
    occurredAt: now,
  });
  const items = await orderItems.listByOrderIds(tenantId, [orderId]);
  return {
    ...updated,
    items: items.filter(
      (item) => isBuyerCancellation || item.seller === userId,
    ),
  };
}

async function createReviewWithRepository(
  reviews: ReviewRepository,
  productRepository: ProductRepository,
  notifications: NotificationRepository,
  userId: string,
  tenantId: string,
  productId: string,
  rating: number,
  comment: string,
) {
  const product = await productRepository.findById(tenantId, productId);
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  if (String(product.seller) === userId)
    throw new AppError(
      403,
      'REVIEW_FORBIDDEN',
      'Sellers cannot review their own products',
    );
  const purchased = await reviews.hasPurchasedProduct(
    tenantId,
    userId,
    productId,
  );
  if (!purchased)
    throw new AppError(
      403,
      'REVIEW_PURCHASE_REQUIRED',
      'Only buyers can review purchased products',
    );
  const now = new Date();
  const review = await reviews.upsert(
    tenantId,
    productId,
    userId,
    rating,
    comment,
    now,
  );
  await notifications.create(
    {
      tenantId,
      userId: String(product.seller),
      message: `New review for ${product.name}`,
    },
    now,
  );
  return review;
}

export function createWatchlistCommerceService(
  watchlists: WatchlistRepository,
  products: ProductRepository,
) {
  return {
    listWatchlist: (userId: string, tenantId: string) =>
      watchlists.list(tenantId, userId),
    addWatchlist: (userId: string, tenantId: string, productId: string) =>
      addWatchlistWithRepository(
        watchlists,
        products,
        userId,
        tenantId,
        productId,
      ),
    removeWatchlist: (userId: string, tenantId: string, productId: string) =>
      watchlists.remove(tenantId, userId, productId),
  };
}

export function createReviewCommerceService(
  reviews: ReviewRepository,
  products: ProductRepository,
  notifications: NotificationRepository,
) {
  return {
    listReviews: (
      tenantId: string,
      productId: string,
      pagination: Pagination,
    ) => reviews.list(tenantId, productId, pagination),
    createReview: (
      userId: string,
      tenantId: string,
      productId: string,
      rating: number,
      comment: string,
    ) =>
      createReviewWithRepository(
        reviews,
        products,
        notifications,
        userId,
        tenantId,
        productId,
        rating,
        comment,
      ),
  };
}

export function createCartCommerceService(
  carts: CartRepository,
  products: ProductRepository,
) {
  return {
    getCart: (userId: string, tenantId: string) =>
      getCartWithRepository(carts, userId, tenantId),
    setCartItem: (
      userId: string,
      tenantId: string,
      productId: string,
      quantity: number,
    ) =>
      setCartItemWithRepository(
        carts,
        products,
        userId,
        tenantId,
        productId,
        quantity,
      ),
    removeCartItem: (userId: string, tenantId: string, productId: string) =>
      removeCartItemWithRepository(carts, userId, tenantId, productId),
  };
}

export function createOrderCommerceService(
  orders: OrderRepository,
  orderItems: OrderItemRepository,
  notifications: NotificationRepository,
  transactions: CheckoutTransactionCoordinator,
) {
  return {
    listOrders: (userId: string, tenantId: string, pagination: OrderListData) =>
      listOrdersWithRepositories(
        orders,
        orderItems,
        userId,
        tenantId,
        pagination,
      ),
    updateOrderStatus: (
      userId: string,
      tenantId: string,
      orderId: string,
      status: OrderStatus,
    ) =>
      transactions.run((repositories) =>
        updateOrderStatusWithRepositories(
          repositories.orders,
          repositories.orderItems,
          repositories.notifications,
          repositories.audits,
          userId,
          tenantId,
          orderId,
          status,
        ),
      ),
  };
}

export function createNotificationCommerceService(
  notifications: NotificationRepository,
) {
  return {
    listNotifications: (
      userId: string,
      tenantId: string,
      pagination: Pagination,
    ) => notifications.list(tenantId, userId, pagination),
    countUnreadNotifications: (userId: string, tenantId: string) =>
      notifications.countUnread(tenantId, userId),
    updateNotificationRead: async (
      userId: string,
      tenantId: string,
      notificationId: string,
      read: boolean,
    ) => {
      const notification = await notifications.updateRead(
        tenantId,
        userId,
        notificationId,
        read,
      );
      if (!notification)
        throw new AppError(
          404,
          'NOTIFICATION_NOT_FOUND',
          'Notification not found',
        );
      return notification;
    },
  };
}

export type CommerceService = ReturnType<typeof createCartCommerceService> &
  CheckoutService &
  ReturnType<typeof createOrderCommerceService> &
  ReturnType<typeof createNotificationCommerceService> &
  ReturnType<typeof createWatchlistCommerceService> &
  ReturnType<typeof createReviewCommerceService>;
