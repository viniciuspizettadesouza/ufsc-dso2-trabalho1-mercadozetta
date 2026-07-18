export const queryKeys = {
  cart: {
    all: ['cart'] as const,
    items: (userId: string) =>
      [...queryKeys.cart.all, 'items', userId] as const,
    productIds: (userId: string) =>
      [...queryKeys.cart.all, 'product-ids', userId] as const,
  },
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (request: ProductListRequest) =>
      [...queryKeys.products.lists(), request] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (productId: string) =>
      [...queryKeys.products.details(), productId] as const,
  },
  sellers: {
    all: ['sellers'] as const,
    profiles: () => [...queryKeys.sellers.all, 'profile'] as const,
    profile: (sellerId: string) =>
      [...queryKeys.sellers.profiles(), sellerId] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    lists: (productId: string) =>
      [...queryKeys.reviews.all, 'list', productId] as const,
    list: (request: ReviewListRequest) =>
      [
        ...queryKeys.reviews.lists(request.productId),
        { limit: request.limit, offset: request.offset },
      ] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    lists: (userId: string) =>
      [...queryKeys.notifications.all, 'list', userId] as const,
    list: (request: NotificationListRequest) =>
      [
        ...queryKeys.notifications.lists(request.userId),
        { limit: request.limit, offset: request.offset },
      ] as const,
    unreadCount: (userId: string) =>
      [...queryKeys.notifications.all, 'unread-count', userId] as const,
  },
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (request: OrderListRequest) =>
      [...queryKeys.orders.lists(), request] as const,
  },
  watchlist: {
    all: ['watchlist'] as const,
    productIds: (userId: string) =>
      [...queryKeys.watchlist.all, 'product-ids', userId] as const,
  },
} as const;

export type ProductListRequest = {
  sellerId: string | null;
  q: string;
  category: string;
  availability: string;
  sort: string;
  limit: number | null;
  offset: number | null;
};

export type ReviewListRequest = {
  productId: string;
  limit: number | null;
  offset: number | null;
};

export type OrderListRequest = {
  userId: string;
  scope: 'buyer' | 'seller';
  limit: number | null;
  offset: number | null;
};

export type NotificationListRequest = {
  userId: string;
  limit: number;
  offset: number;
};
