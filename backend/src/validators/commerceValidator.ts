import { z } from 'zod';
import { isUuid, UUID_EXAMPLE } from '@/ids';
import { orderStatuses } from '@/orderStatus';
import { parseAppSchema, requestString } from '@/validators/parseSchema';
import { paginationSchema } from '@/validators/paginationValidator';
import { productResponseSchema } from '@/validators/productValidator';
import { exactMoneySchema } from '@/validators/productValidator';
import { paginatedResponseSchema } from '@/validators/responseSchemas';

export const resourceIdSchema = z
  .unknown()
  .transform((value) => requestString(value).trim().toLowerCase())
  .refine((value) => isUuid(value), {
    message: 'Invalid resource id',
    params: { appCode: 'INVALID_RESOURCE_ID', statusCode: 400 },
  })
  .meta({
    id: 'ResourceId',
    example: UUID_EXAMPLE,
    override: { type: 'string', format: 'uuid' },
  });

export const cartItemRequestSchema = z
  .object({
    productId: resourceIdSchema,
    quantity: z.coerce.number().int().min(1).default(1),
  })
  .meta({ id: 'CartItemRequest' });

export const cartItemResponseSchema = z
  .object({
    product: productResponseSchema,
    quantity: z.int().min(1),
  })
  .meta({ id: 'CartItem' });

export const cartResponseSchema = z
  .object({
    tenantId: z.string(),
    buyer: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    items: z.array(cartItemResponseSchema),
  })
  .meta({ id: 'Cart' });

export const cartErrorCodes = {
  tenant: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT'],
  itemRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'INVALID_RESOURCE_ID',
  ],
  itemPath: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT', 'INVALID_RESOURCE_ID'],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  productNotFound: ['PRODUCT_NOT_FOUND'],
  inventoryConflict: ['INSUFFICIENT_INVENTORY'],
} as const;

export const cartInvalidRequestExample = {
  error: 'Too small: expected number to be >=1',
  code: 'INVALID_REQUEST',
} as const;

export const watchlistEntryResponseSchema = z
  .object({
    _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    tenantId: z.string(),
    user: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    product: productResponseSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'WatchlistEntry' });

export const watchlistResponseSchema = z
  .array(watchlistEntryResponseSchema)
  .meta({ id: 'Watchlist' });

export const watchlistErrorCodes = {
  tenant: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT'],
  itemPath: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT', 'INVALID_RESOURCE_ID'],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  productNotFound: ['PRODUCT_NOT_FOUND'],
} as const;

export const createReviewRequestSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000),
  })
  .meta({ id: 'CreateReviewRequest' });

export const reviewResponseSchema = z
  .object({
    _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    tenantId: z.string(),
    product: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    author: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    rating: z.int().min(1).max(5),
    comment: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Review' });

export const reviewListResponseSchema = paginatedResponseSchema(
  reviewResponseSchema,
).meta({ id: 'ReviewList' });

export const reviewErrorCodes = {
  listRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_RESOURCE_ID',
    'INVALID_REQUEST',
  ],
  createRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'IDEMPOTENCY_KEY_REQUIRED',
    'INVALID_IDEMPOTENCY_KEY',
    'INVALID_RESOURCE_ID',
    'INVALID_REQUEST',
  ],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  authorization: [
    'INVALID_ORIGIN',
    'INVALID_CSRF_TOKEN',
    'REVIEW_FORBIDDEN',
    'REVIEW_PURCHASE_REQUIRED',
  ],
  productNotFound: ['PRODUCT_NOT_FOUND'],
  idempotencyConflict: ['IDEMPOTENCY_KEY_REUSED'],
} as const;

export const reviewInvalidRequestExamples = {
  list: {
    error: 'Too small: expected number to be >=0',
    code: 'INVALID_REQUEST',
  },
  create: {
    error: 'Too small: expected string to have >=1 characters',
    code: 'INVALID_REQUEST',
  },
} as const;

export const orderStatusResponseSchema = z
  .enum(orderStatuses)
  .meta({ id: 'OrderStatus' });

export const orderStatusUpdateRequestSchema = z
  .object({ status: orderStatusResponseSchema })
  .meta({ id: 'OrderStatusUpdateRequest' });

export const orderItemResponseSchema = z
  .object({
    tenantId: z.string(),
    order: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    product: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    seller: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    productName: z.string(),
    quantity: z.int().min(1),
    pricingState: z.enum(['legacy_unpriced', 'priced']),
    unitPrice: exactMoneySchema.nullable(),
    lineSubtotal: exactMoneySchema.nullable(),
  })
  .meta({ id: 'OrderItem' });

export const orderStatusHistoryResponseSchema = z
  .object({
    status: orderStatusResponseSchema,
    actor: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    changedAt: z.iso.datetime(),
  })
  .meta({ id: 'OrderStatusHistoryEntry' });

export const orderResponseSchema = z
  .object({
    _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    tenantId: z.string(),
    buyer: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    status: orderStatusResponseSchema,
    pricingState: z.enum(['legacy_unpriced', 'priced']),
    subtotal: exactMoneySchema.nullable(),
    discount: exactMoneySchema.nullable(),
    shipping: exactMoneySchema.nullable(),
    total: exactMoneySchema.nullable(),
    statusHistory: z.array(orderStatusHistoryResponseSchema),
    items: z.array(orderItemResponseSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Order' });

export const orderListResponseSchema = paginatedResponseSchema(
  orderResponseSchema,
).meta({ id: 'OrderList' });

export const orderErrorCodes = {
  listRequest: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT', 'INVALID_REQUEST'],
  checkoutRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'IDEMPOTENCY_KEY_REQUIRED',
    'INVALID_IDEMPOTENCY_KEY',
    'EMPTY_CART',
  ],
  statusRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_RESOURCE_ID',
    'INVALID_REQUEST',
  ],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  ownership: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN', 'ORDER_FORBIDDEN'],
  inventoryConflict: [
    'INSUFFICIENT_INVENTORY',
    'PRODUCT_PRICE_REQUIRED',
    'ORDER_TOTAL_LIMIT_EXCEEDED',
  ],
  notFound: ['ORDER_NOT_FOUND'],
  transitionConflict: ['ORDER_STATUS_TRANSITION_INVALID'],
} as const;

export const orderInvalidRequestExamples = {
  list: {
    error: 'Invalid option: expected one of "all"|"buyer"|"seller"',
    code: 'INVALID_REQUEST',
  },
  status: {
    error:
      'Invalid option: expected one of "placed"|"confirmed"|"shipped"|"delivered"|"cancelled"',
    code: 'INVALID_REQUEST',
  },
  inventory: {
    error: 'A cart item is unavailable',
    code: 'INSUFFICIENT_INVENTORY',
  },
  priceRequired: {
    error: 'A cart item has no current price',
    code: 'PRODUCT_PRICE_REQUIRED',
  },
  totalLimit: {
    error: 'Order amount exceeds the supported limit',
    code: 'ORDER_TOTAL_LIMIT_EXCEEDED',
  },
} as const;
export const notificationReadRequestSchema = z
  .object({ read: z.boolean() })
  .meta({ id: 'NotificationReadRequest' });

export const notificationResponseSchema = z
  .object({
    _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    tenantId: z.string(),
    user: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    message: z.string(),
    read: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Notification' });

export const notificationListResponseSchema = paginatedResponseSchema(
  notificationResponseSchema,
).meta({ id: 'NotificationList' });

export const unreadNotificationCountResponseSchema = z
  .object({ count: z.int().min(0) })
  .meta({ id: 'UnreadNotificationCount' });

export const notificationErrorCodes = {
  listRequest: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT', 'INVALID_REQUEST'],
  tenant: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT'],
  updateRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_RESOURCE_ID',
    'INVALID_REQUEST',
  ],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  notFound: ['NOTIFICATION_NOT_FOUND'],
} as const;

export const notificationInvalidRequestExamples = {
  list: {
    error: 'Too small: expected number to be >=0',
    code: 'INVALID_REQUEST',
  },
  update: {
    error: 'Invalid input: expected boolean, received string',
    code: 'INVALID_REQUEST',
  },
} as const;
export const orderListSchema = paginationSchema.extend({
  scope: z.enum(['all', 'buyer', 'seller']).default('all'),
  status: orderStatusResponseSchema.optional(),
  q: z.string().trim().max(100).default(''),
});
export type OrderListData = z.infer<typeof orderListSchema>;

export const sellerOperationsQuerySchema = paginationSchema.extend({
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(5),
});
export type SellerOperationsQuery = z.infer<typeof sellerOperationsQuerySchema>;

export const inventoryHistoryEntryResponseSchema = z
  .object({
    _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    eventType: z.enum(['inventory.set', 'inventory.decremented']),
    product: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    productName: z.string(),
    previousInventory: z.int().min(0),
    nextInventory: z.int().min(0),
    quantity: z.int().positive().nullable(),
    orderId: z.string().uuid().nullable().meta({ example: UUID_EXAMPLE }),
    occurredAt: z.iso.datetime(),
  })
  .meta({ id: 'InventoryHistoryEntry' });

export const sellerOperationsResponseSchema = z
  .object({
    summary: z.object({
      productCount: z.int().min(0),
      activeProductCount: z.int().min(0),
      lowStockProductCount: z.int().min(0),
      inventoryUnits: z.int().min(0),
      orderCount: z.int().min(0),
      openOrderCount: z.int().min(0),
      orderedUnits: z.int().min(0),
      pricedOrderCount: z.int().min(0),
      legacyUnpricedOrderCount: z.int().min(0),
      grossRevenue: exactMoneySchema,
    }),
    lowStockProducts: z.array(
      z.object({
        _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
        name: z.string(),
        inventory: z.int().min(0),
        status: z.enum(['draft', 'active', 'paused', 'sold_out']),
      }),
    ),
    inventoryHistory: paginatedResponseSchema(
      inventoryHistoryEntryResponseSchema,
    ),
  })
  .meta({ id: 'SellerOperations' });

export const sellerOperationsErrorCodes = {
  request: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT', 'INVALID_REQUEST'],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
} as const;

export const validateResourceId = (value: unknown) =>
  parseAppSchema(resourceIdSchema, value);
export const validateCartItem = (value: object) =>
  parseAppSchema(cartItemRequestSchema, value);
export const validateReview = (value: object) =>
  parseAppSchema(createReviewRequestSchema, value);
export const validateOrderStatus = (value: object) =>
  parseAppSchema(orderStatusUpdateRequestSchema, value);
export const validateNotificationRead = (value: object) =>
  parseAppSchema(notificationReadRequestSchema, value);
export const validateOrderList = (value: object) =>
  parseAppSchema(orderListSchema, value);
export const validateSellerOperations = (value: object) =>
  parseAppSchema(sellerOperationsQuerySchema, value);
