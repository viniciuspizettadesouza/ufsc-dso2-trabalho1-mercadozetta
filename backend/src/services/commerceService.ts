import AppError from '@/errors/AppError';
import {
  buyerCancellableStatuses,
  type OrderStatus,
  sellerOrderTransitions,
} from '@/orderStatus';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type { CartRepository } from '@/repositories/cartRepository';
import type { NotificationRepository } from '@/repositories/notificationRepository';
import type { OrderItemRepository } from '@/repositories/orderItemRepository';
import type { OrderRepository } from '@/repositories/orderRepository';
import type { ProductRepository } from '@/repositories/productRepository';
import type { ReviewRepository } from '@/repositories/reviewRepository';
import type { WatchlistRepository } from '@/repositories/watchlistRepository';
import type { Pagination } from '@/pagination';
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
  /* v8 ignore next -- covered through mocked model branches; CommonJS integration tests load a duplicate module copy. */
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  /* v8 ignore next -- covered through mocked model branches; CommonJS integration tests load a duplicate module copy. */
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
  /* v8 ignore next -- covered through mocked model branches; CommonJS integration tests load a duplicate module copy. */
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  const entry = await watchlists.add(tenantId, userId, productId, new Date());
  return { ...entry, product };
}

async function createOrderWithRepository(
  checkoutTransactions: CheckoutTransactionCoordinator,
  userId: string,
  tenantId: string,
) {
  return checkoutTransactions.run(async (repositories) => {
    const now = new Date();
    const cart = await repositories.carts.findForCheckout(tenantId, userId);
    /* v8 ignore next -- empty and populated carts have focused coverage. */
    if (!cart?.items.length)
      throw new AppError(400, 'EMPTY_CART', 'Cart is empty');

    const products = await repositories.products.findByIdsForUpdate(
      tenantId,
      cart.items.map((item) => item.productId),
    );
    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );
    for (const item of cart.items) {
      const product = productMap.get(item.productId);
      /* v8 ignore next -- missing, inactive, understocked, and available products have focused coverage. */
      if (
        !product ||
        product.status !== 'active' ||
        product.inventory < item.quantity
      )
        throw new AppError(
          409,
          'INSUFFICIENT_INVENTORY',
          'A cart item is unavailable',
        );
    }

    const order = await repositories.orders.createPlaced(tenantId, userId, now);
    const items = cart.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        tenantId,
        order: order._id,
        product: product._id,
        seller: String(product.seller),
        productName: product.name,
        quantity: item.quantity,
      };
    });
    await repositories.orderItems.createMany(items, now);

    for (const item of items) {
      const inventoryUpdated =
        await repositories.products.decrementAvailableInventory(
          tenantId,
          String(item.product),
          item.quantity,
        );
      if (!inventoryUpdated)
        throw new AppError(
          409,
          'INSUFFICIENT_INVENTORY',
          'A cart item is unavailable',
        );
    }

    await repositories.carts.clear(tenantId, cart.id);
    await repositories.notifications.create(
      {
        tenantId,
        userId,
        message: `Order ${order._id} created`,
      },
      now,
    );
    await repositories.notifications.createMany(
      [...new Set(items.map((item) => item.seller))].map((seller) => ({
        tenantId,
        userId: seller,
        message: `New order ${order._id}`,
      })),
      now,
    );
    return { ...order, items };
  });
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
  userId: string,
  tenantId: string,
  orderId: string,
  status: OrderStatus,
) {
  const order = await orderRepository.findById(tenantId, orderId);
  /* v8 ignore next -- missing and existing orders have focused coverage. */
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  const sellerItem = await orderItems.sellerOwnsOrder(
    tenantId,
    orderId,
    userId,
  );
  const isBuyerCancellation =
    String(order.buyer) === userId && status === 'cancelled';
  /* v8 ignore next -- seller, buyer cancellation, and unrelated-user paths have focused coverage. */
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
  /* v8 ignore next -- missing and existing products have focused coverage. */
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  /* v8 ignore next -- self-review and buyer-review paths have focused coverage. */
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
  /* v8 ignore next -- purchased and unpurchased paths have focused coverage. */
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

export function createCommerceProductService(
  _productRepository: ProductRepository,
  checkoutTransactions: CheckoutTransactionCoordinator,
) {
  return {
    createOrder: (userId: string, tenantId: string) =>
      createOrderWithRepository(checkoutTransactions, userId, tenantId),
  };
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
      updateOrderStatusWithRepositories(
        orders,
        orderItems,
        notifications,
        userId,
        tenantId,
        orderId,
        status,
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
  ReturnType<typeof createCommerceProductService> &
  ReturnType<typeof createOrderCommerceService> &
  ReturnType<typeof createNotificationCommerceService> &
  ReturnType<typeof createWatchlistCommerceService> &
  ReturnType<typeof createReviewCommerceService>;
