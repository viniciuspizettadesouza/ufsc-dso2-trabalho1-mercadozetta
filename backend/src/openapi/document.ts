import { z } from 'zod';
import { UUID_EXAMPLE } from '@/ids';
import { createDocument } from 'zod-openapi';
import {
  loginSchema,
  authStateResponseSchema,
  sessionListResponseSchema,
  authErrorCodes,
  authInvalidRequestExample,
} from '@/validators/authValidator';
import {
  createProductSchema,
  productFiltersSchema,
  productIdSchema,
  sellerIdSchema,
  updateProductSchema,
  productInventoryUpdateSchema,
  productStatusUpdateSchema,
  productResponseSchema,
  productErrorCodes,
  productInvalidRequestExamples,
} from '@/validators/productValidator';
import { paginationSchema } from '@/validators/paginationValidator';
import {
  cartErrorCodes,
  cartInvalidRequestExample,
  cartItemRequestSchema,
  cartResponseSchema,
  createReviewRequestSchema,
  notificationErrorCodes,
  notificationInvalidRequestExamples,
  notificationListResponseSchema,
  notificationReadRequestSchema,
  notificationResponseSchema,
  orderErrorCodes,
  orderInvalidRequestExamples,
  orderListSchema,
  orderListResponseSchema,
  orderResponseSchema,
  orderStatusUpdateRequestSchema,
  reviewErrorCodes,
  reviewInvalidRequestExamples,
  reviewListResponseSchema,
  reviewResponseSchema,
  unreadNotificationCountResponseSchema,
  watchlistEntryResponseSchema,
  watchlistErrorCodes,
  watchlistResponseSchema,
} from '@/validators/commerceValidator';
import {
  createUserSchema,
  userResponseSchema,
  sellerProfileResponseSchema,
  userErrorCodes,
  userInvalidRequestExample,
} from '@/validators/userValidator';
import {
  errorResponseSchemaFor,
  appErrorExamples,
  type AppErrorExample,
  type AppErrorExampleCode,
  paginatedResponseSchema,
} from '@/validators/responseSchemas';

const tenantHeader = z
  .string()
  .optional()
  .meta({
    param: { name: 'X-Tenant-Id', in: 'header' },
    description:
      'Tenant slug. Required when TENANT_HEADER_REQUIRED is enabled; defaults to mercadozetta otherwise.',
    example: 'mercadozetta',
  });

const resourceId = z.string().uuid().meta({ example: UUID_EXAMPLE });
const csrfHeader = z.string().meta({
  param: { name: 'X-CSRF-Token', in: 'header' },
  description:
    'Session-bound double-submit proof required for cookie-authenticated mutations.',
  example: 'nonce.signature',
});

const welcomeSchema = z.object({ message: z.string() }).meta({ id: 'Welcome' });
const healthSchema = z
  .object({ status: z.literal('ok') })
  .meta({ id: 'Health' });
const readinessSchema = z
  .object({
    status: z.enum(['ready', 'not_ready']),
    checks: z.object({
      postgresql: z.enum(['connected', 'disconnected']),
    }),
  })
  .meta({ id: 'Readiness' });
const pageExample = { limit: 20, offset: 0, total: 1, hasMore: false };

const productExample = {
  _id: '507f191e-810c-4197-9de8-60ea00000001',
  tenantId: 'mercadozetta',
  name: 'mechanical keyboard',
  description: 'Compact keyboard',
  category: 'electronics',
  subcategory: 'keyboards',
  inventory: 5,
  image: 'https://example.com/keyboard.jpg',
  status: 'active',
  seller: '507f1f77-bcf8-4ecd-8994-390110000001',
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

const userExample = {
  _id: '507f1f77-bcf8-4ecd-8994-390110000001',
  tenantId: 'mercadozetta',
  email: 'seller@example.com',
  username: 'seller',
  telephone: '+55 48 99999-0000',
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

const sessionExample = {
  id: '507f1f77-bcf8-4ecd-8994-390120000002',
  createdAt: '2026-07-15T12:00:00.000Z',
  lastUsedAt: '2026-07-15T12:00:00.000Z',
  expiresAt: '2026-07-22T12:00:00.000Z',
  absoluteExpiresAt: '2026-08-14T12:00:00.000Z',
  userAgentLabel: 'Chrome on Linux',
};

const sellerProfileExample = {
  _id: userExample._id,
  email: userExample.email,
  username: userExample.username,
  telephone: userExample.telephone,
  storeName: 'seller store',
};

const orderExample = {
  _id: '507f191e-810c-4197-9de8-60ea00000004',
  tenantId: 'mercadozetta',
  buyer: userExample._id,
  status: 'placed',
  statusHistory: [
    {
      status: 'placed',
      actor: userExample._id,
      changedAt: '2026-07-13T10:00:00.000Z',
    },
  ],
  items: [
    {
      tenantId: 'mercadozetta',
      order: '507f191e-810c-4197-9de8-60ea00000004',
      product: productExample._id,
      seller: productExample.seller,
      productName: productExample.name,
      quantity: 1,
    },
  ],
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
};

const json = (schema: z.ZodType, example?: unknown) => ({
  'application/json': { schema, ...(example === undefined ? {} : { example }) },
});

const appErrors = <
  const TCodes extends readonly [AppErrorExampleCode, ...AppErrorExampleCode[]],
>(
  description: string,
  codes: TCodes,
  examples: Partial<Record<AppErrorExampleCode, AppErrorExample>> = {},
) => ({
  description,
  content: {
    'application/json': {
      schema: errorResponseSchemaFor(codes),
      examples: Object.fromEntries(
        codes.map((code) => [
          code,
          { summary: code, value: examples[code] ?? appErrorExamples[code] },
        ]),
      ),
    },
  },
});

export function createOpenApiDocument() {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'MercadoZetta API',
      version: '1.0.0',
      description: 'HTTP contract for the current white-label marketplace API.',
    },
    servers: [
      { url: 'http://localhost:3333', description: 'Local development' },
    ],
    tags: [
      { name: 'System' },
      { name: 'Authentication' },
      { name: 'Users' },
      { name: 'Products' },
      { name: 'Commerce' },
    ],
    paths: {
      '/': {
        get: {
          tags: ['System'],
          summary: 'Describe the API',
          responses: {
            200: {
              description: 'Welcome message',
              content: json(welcomeSchema, {
                message: 'Welcome to zetta2k app',
              }),
            },
          },
        },
      },
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Check process health',
          responses: {
            200: {
              description: 'The API process is healthy',
              content: json(healthSchema, { status: 'ok' }),
            },
          },
        },
      },
      '/ready': {
        get: {
          tags: ['System'],
          summary: 'Check database readiness',
          responses: {
            200: {
              description: 'The API is ready',
              content: json(readinessSchema, {
                status: 'ready',
                checks: { postgresql: 'connected' },
              }),
            },
            503: {
              description: 'PostgreSQL is unavailable',
              content: json(readinessSchema, {
                status: 'not_ready',
                checks: { postgresql: 'disconnected' },
              }),
            },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Log in',
          parameters: [tenantHeader],
          requestBody: {
            required: true,
            content: json(loginSchema, {
              email: 'seller@example.com',
              password: 'password123',
            }),
          },
          responses: {
            200: {
              description:
                'Authenticated session; also sets access, refresh, and CSRF cookies',
              content: json(authStateResponseSchema, {
                user: userExample,
                session: sessionExample,
              }),
            },
            400: appErrors(
              'Invalid tenant or login payload',
              authErrorCodes.loginRequest,
              { INVALID_REQUEST: authInvalidRequestExample },
            ),
            401: appErrors(
              'Invalid credentials',
              authErrorCodes.invalidCredentials,
            ),
            403: appErrors(
              'Origin validation failed',
              authErrorCodes.loginOrigin,
            ),
            429: appErrors(
              'Login rate limit exceeded',
              authErrorCodes.loginRateLimit,
            ),
          },
        },
      },
      '/auth/session': {
        get: {
          tags: ['Authentication'],
          summary: 'Restore the current cookie session',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          responses: {
            200: {
              description: 'Current user and session',
              content: json(authStateResponseSchema, {
                user: userExample,
                session: sessionExample,
              }),
            },
            400: appErrors('Invalid tenant', authErrorCodes.tenant),
            401: appErrors(
              'Missing, invalid, or incomplete cookie session',
              authErrorCodes.sessionAuthentication,
            ),
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Rotate the current refresh token',
          security: [{ refreshCookie: [] }],
          parameters: [tenantHeader, csrfHeader],
          responses: {
            204: { description: 'Session rotated and cookies replaced' },
            400: appErrors('Invalid tenant', authErrorCodes.tenant),
            401: appErrors(
              'Invalid, expired, or reused refresh token',
              authErrorCodes.refreshAuthentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              authErrorCodes.csrf,
            ),
            409: appErrors(
              'A concurrent request already rotated the token',
              authErrorCodes.refreshConflict,
            ),
          },
        },
      },
      '/auth/sessions': {
        get: {
          tags: ['Authentication'],
          summary: 'List active sessions for the current tenant/user',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          responses: {
            200: {
              description: 'Active sessions',
              content: json(sessionListResponseSchema, {
                sessions: [sessionExample],
              }),
            },
            400: appErrors('Invalid tenant', authErrorCodes.tenant),
            401: appErrors(
              'Missing or invalid cookie session',
              authErrorCodes.authentication,
            ),
          },
        },
      },
      '/auth/sessions/{sessionId}': {
        delete: {
          tags: ['Authentication'],
          summary: 'Revoke one owned session',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ sessionId: resourceId }) },
          responses: {
            204: { description: 'Session revoked' },
            400: appErrors(
              'Invalid tenant or session identifier',
              authErrorCodes.sessionId,
            ),
            401: appErrors(
              'Missing or invalid cookie session',
              authErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              authErrorCodes.csrf,
            ),
            404: appErrors(
              'Owned session not found',
              authErrorCodes.sessionNotFound,
            ),
          },
        },
      },
      '/auth/logout/current': {
        post: {
          tags: ['Authentication'],
          summary: 'Revoke the current cookie session',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          responses: {
            204: { description: 'Current session revoked' },
            400: appErrors('Invalid tenant', authErrorCodes.tenant),
            401: appErrors(
              'Missing, invalid, or incomplete cookie session',
              authErrorCodes.sessionAuthentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              authErrorCodes.csrf,
            ),
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Log out and invalidate existing access tokens',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          responses: {
            204: { description: 'Logged out' },
            400: appErrors('Invalid tenant', authErrorCodes.tenant),
            401: appErrors(
              'Missing or invalid cookie session',
              authErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              authErrorCodes.csrf,
            ),
          },
        },
      },
      '/users': {
        post: {
          tags: ['Users'],
          summary: 'Create an account',
          parameters: [tenantHeader],
          requestBody: {
            required: true,
            content: json(createUserSchema, {
              email: 'seller@example.com',
              password: 'password123',
              username: 'seller',
              telephone: '+55 48 99999-0000',
            }),
          },
          responses: {
            201: {
              description: 'Account created',
              content: json(userResponseSchema, userExample),
            },
            400: appErrors(
              'Invalid tenant or registration payload',
              userErrorCodes.create,
              { INVALID_REQUEST: userInvalidRequestExample },
            ),
            429: appErrors(
              'Registration rate limit exceeded',
              userErrorCodes.rateLimit,
            ),
          },
        },
      },
      '/users/{userId}': {
        get: {
          tags: ['Users'],
          summary: 'Get a seller profile',
          parameters: [tenantHeader],
          requestParams: { path: z.object({ userId: sellerIdSchema }) },
          responses: {
            200: {
              description: 'Public seller profile',
              content: json(sellerProfileResponseSchema, sellerProfileExample),
            },
            400: appErrors(
              'Invalid tenant or seller identifier',
              userErrorCodes.sellerDetail,
            ),
            404: appErrors('Seller not found', userErrorCodes.sellerNotFound),
          },
        },
      },
      '/users/{userId}/products': {
        get: {
          tags: ['Products'],
          summary: 'List products from one seller',
          parameters: [tenantHeader],
          requestParams: {
            path: z.object({ userId: sellerIdSchema }),
            query: productFiltersSchema,
          },
          responses: {
            200: {
              description: 'Products from the seller',
              content: json(paginatedResponseSchema(productResponseSchema), {
                items: [productExample],
                page: pageExample,
              }),
            },
            400: appErrors(
              'Invalid seller, tenant, pagination, or product filters',
              productErrorCodes.sellerList,
              { INVALID_REQUEST: productInvalidRequestExamples.list },
            ),
          },
        },
      },
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'Search and list products',
          parameters: [tenantHeader],
          requestParams: { query: productFiltersSchema },
          responses: {
            200: {
              description: 'Products in the current tenant',
              content: json(paginatedResponseSchema(productResponseSchema), {
                items: [productExample],
                page: pageExample,
              }),
            },
            400: appErrors(
              'Invalid tenant, pagination, or product filters',
              productErrorCodes.list,
              { INVALID_REQUEST: productInvalidRequestExamples.list },
            ),
          },
        },
        post: {
          tags: ['Products'],
          summary: 'Create a product',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestBody: {
            required: true,
            content: json(createProductSchema, {
              name: 'Mechanical keyboard',
              description: 'Compact keyboard',
              category: 'electronics',
              subcategory: 'keyboards',
              inventory: 5,
              image: 'https://example.com/keyboard.jpg',
              status: 'active',
            }),
          },
          responses: {
            201: {
              description: 'Product created',
              content: json(productResponseSchema, productExample),
            },
            400: appErrors(
              'Invalid tenant or product payload',
              productErrorCodes.create,
              { INVALID_REQUEST: productInvalidRequestExamples.create },
            ),
            401: appErrors(
              'Missing or invalid session',
              productErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              productErrorCodes.csrf,
            ),
          },
        },
      },
      '/products/{productId}': {
        get: {
          tags: ['Products'],
          summary: 'Get a product',
          parameters: [tenantHeader],
          requestParams: { path: z.object({ productId: productIdSchema }) },
          responses: {
            200: {
              description: 'Product detail',
              content: json(productResponseSchema, {
                ...productExample,
                sellerProfile: sellerProfileExample,
              }),
            },
            400: appErrors(
              'Invalid tenant or product identifier',
              productErrorCodes.detail,
            ),
            404: appErrors('Product not found', productErrorCodes.notFound),
          },
        },
        patch: {
          tags: ['Products'],
          summary: 'Edit seller-owned product details',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: productIdSchema }) },
          requestBody: {
            required: true,
            content: json(updateProductSchema, {
              name: 'Mechanical keyboard',
              description: 'Compact keyboard',
            }),
          },
          responses: {
            200: {
              description: 'Updated product',
              content: json(productResponseSchema, productExample),
            },
            400: appErrors(
              'Invalid tenant, product identifier, or update payload',
              productErrorCodes.update,
              { INVALID_REQUEST: productInvalidRequestExamples.update },
            ),
            401: appErrors(
              'Missing or invalid session',
              productErrorCodes.authentication,
            ),
            403: appErrors(
              'Ownership, Origin, or CSRF validation failed',
              productErrorCodes.ownership,
            ),
            404: appErrors('Product not found', productErrorCodes.notFound),
          },
        },
      },
      '/products/{productId}/inventory': {
        patch: {
          tags: ['Products'],
          summary: 'Set seller-owned product inventory',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: productIdSchema }) },
          requestBody: {
            required: true,
            content: json(productInventoryUpdateSchema, { inventory: 10 }),
          },
          responses: {
            200: {
              description: 'Updated product',
              content: json(productResponseSchema, productExample),
            },
            400: appErrors(
              'Invalid tenant, product identifier, or inventory payload',
              productErrorCodes.inventory,
              { INVALID_REQUEST: productInvalidRequestExamples.inventory },
            ),
            401: appErrors(
              'Missing or invalid session',
              productErrorCodes.authentication,
            ),
            403: appErrors(
              'Ownership, Origin, or CSRF validation failed',
              productErrorCodes.ownership,
            ),
            404: appErrors('Product not found', productErrorCodes.notFound),
          },
        },
      },
      '/products/{productId}/status': {
        patch: {
          tags: ['Products'],
          summary: 'Change seller-owned product lifecycle status',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: productIdSchema }) },
          requestBody: {
            required: true,
            content: json(productStatusUpdateSchema, { status: 'paused' }),
          },
          responses: {
            200: {
              description: 'Updated product',
              content: json(productResponseSchema, productExample),
            },
            400: appErrors(
              'Invalid tenant, product identifier, or status payload',
              productErrorCodes.status,
              { INVALID_REQUEST: productInvalidRequestExamples.status },
            ),
            401: appErrors(
              'Missing or invalid session',
              productErrorCodes.authentication,
            ),
            403: appErrors(
              'Ownership, Origin, or CSRF validation failed',
              productErrorCodes.ownership,
            ),
            404: appErrors('Product not found', productErrorCodes.notFound),
            409: appErrors(
              'Invalid lifecycle transition',
              productErrorCodes.lifecycleConflict,
            ),
          },
        },
      },
      '/cart': {
        get: {
          tags: ['Commerce'],
          summary: 'Get the current buyer cart',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          responses: {
            200: {
              description: 'Cart',
              content: json(cartResponseSchema, {
                tenantId: 'mercadozetta',
                buyer: userExample._id,
                items: [],
              }),
            },
            400: appErrors('Invalid tenant', cartErrorCodes.tenant),
            401: appErrors(
              'Missing or invalid session',
              cartErrorCodes.authentication,
            ),
          },
        },
      },
      '/cart/items': {
        put: {
          tags: ['Commerce'],
          summary: 'Add or update a cart item',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestBody: {
            required: true,
            content: json(cartItemRequestSchema, {
              productId: productExample._id,
              quantity: 1,
            }),
          },
          responses: {
            200: {
              description: 'Updated cart',
              content: json(cartResponseSchema, {
                tenantId: 'mercadozetta',
                buyer: userExample._id,
                items: [{ product: productExample, quantity: 1 }],
              }),
            },
            400: appErrors(
              'Invalid tenant, product identifier, or cart item payload',
              cartErrorCodes.itemRequest,
              { INVALID_REQUEST: cartInvalidRequestExample },
            ),
            401: appErrors(
              'Missing or invalid session',
              cartErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              cartErrorCodes.csrf,
            ),
            404: appErrors('Product not found', cartErrorCodes.productNotFound),
            409: appErrors(
              'Requested quantity exceeds inventory',
              cartErrorCodes.inventoryConflict,
            ),
          },
        },
      },
      '/cart/items/{productId}': {
        delete: {
          tags: ['Commerce'],
          summary: 'Remove a cart item',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: resourceId }) },
          responses: {
            200: {
              description: 'Updated cart',
              content: json(cartResponseSchema, {
                tenantId: 'mercadozetta',
                buyer: userExample._id,
                items: [],
              }),
            },
            400: appErrors(
              'Invalid tenant or product identifier',
              cartErrorCodes.itemPath,
            ),
            401: appErrors(
              'Missing or invalid session',
              cartErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              cartErrorCodes.csrf,
            ),
          },
        },
      },
      '/watchlist': {
        get: {
          tags: ['Commerce'],
          summary: 'List watched products',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          responses: {
            200: {
              description: 'Watchlist',
              content: json(watchlistResponseSchema, []),
            },
            400: appErrors('Invalid tenant', watchlistErrorCodes.tenant),
            401: appErrors(
              'Missing or invalid session',
              watchlistErrorCodes.authentication,
            ),
          },
        },
      },
      '/watchlist/{productId}': {
        put: {
          tags: ['Commerce'],
          summary: 'Watch a product',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: resourceId }) },
          responses: {
            201: {
              description: 'Watchlist entry',
              content: json(watchlistEntryResponseSchema, {
                _id: productExample._id,
                tenantId: 'mercadozetta',
                user: userExample._id,
                product: productExample,
                createdAt: '2026-01-15T12:00:00.000Z',
                updatedAt: '2026-01-15T12:00:00.000Z',
              }),
            },
            400: appErrors(
              'Invalid tenant or product identifier',
              watchlistErrorCodes.itemPath,
            ),
            401: appErrors(
              'Missing or invalid session',
              watchlistErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              watchlistErrorCodes.csrf,
            ),
            404: appErrors(
              'Product not found',
              watchlistErrorCodes.productNotFound,
            ),
          },
        },
        delete: {
          tags: ['Commerce'],
          summary: 'Stop watching a product',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: resourceId }) },
          responses: {
            204: { description: 'Watchlist entry removed' },
            400: appErrors(
              'Invalid tenant or product identifier',
              watchlistErrorCodes.itemPath,
            ),
            401: appErrors(
              'Missing or invalid session',
              watchlistErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              watchlistErrorCodes.csrf,
            ),
          },
        },
      },
      '/orders': {
        get: {
          tags: ['Commerce'],
          summary: 'List buyer and seller orders',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          requestParams: { query: orderListSchema },
          responses: {
            200: {
              description: 'Orders',
              content: json(orderListResponseSchema, {
                items: [],
                page: { ...pageExample, total: 0 },
              }),
            },
            400: appErrors(
              'Invalid tenant, scope, or pagination',
              orderErrorCodes.listRequest,
              { INVALID_REQUEST: orderInvalidRequestExamples.list },
            ),
            401: appErrors(
              'Missing or invalid session',
              orderErrorCodes.authentication,
            ),
          },
        },
        post: {
          tags: ['Commerce'],
          summary: 'Place an order from the current cart',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          responses: {
            201: {
              description: 'Order placed',
              content: json(orderResponseSchema, orderExample),
            },
            400: appErrors(
              'Invalid tenant or empty cart',
              orderErrorCodes.checkoutRequest,
            ),
            401: appErrors(
              'Missing or invalid session',
              orderErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              orderErrorCodes.csrf,
            ),
            409: appErrors(
              'A cart item is unavailable',
              orderErrorCodes.inventoryConflict,
              {
                INSUFFICIENT_INVENTORY: orderInvalidRequestExamples.inventory,
              },
            ),
          },
        },
      },
      '/orders/{orderId}/status': {
        patch: {
          tags: ['Commerce'],
          summary: 'Update an order lifecycle status',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ orderId: resourceId }) },
          requestBody: {
            required: true,
            content: json(orderStatusUpdateRequestSchema, {
              status: 'shipped',
            }),
          },
          responses: {
            200: {
              description: 'Updated order',
              content: json(orderResponseSchema, {
                ...orderExample,
                status: 'shipped',
                statusHistory: [
                  ...orderExample.statusHistory,
                  {
                    status: 'shipped',
                    actor: userExample._id,
                    changedAt: '2026-07-13T11:00:00.000Z',
                  },
                ],
                updatedAt: '2026-07-13T11:00:00.000Z',
              }),
            },
            400: appErrors(
              'Invalid tenant, order identifier, or status payload',
              orderErrorCodes.statusRequest,
              { INVALID_REQUEST: orderInvalidRequestExamples.status },
            ),
            401: appErrors(
              'Missing or invalid session',
              orderErrorCodes.authentication,
            ),
            403: appErrors(
              'Ownership, Origin, or CSRF validation failed',
              orderErrorCodes.ownership,
            ),
            404: appErrors('Order not found', orderErrorCodes.notFound),
            409: appErrors(
              'Invalid order status transition',
              orderErrorCodes.transitionConflict,
            ),
          },
        },
      },
      '/products/{productId}/reviews': {
        get: {
          tags: ['Commerce'],
          summary: 'List product reviews',
          parameters: [tenantHeader],
          requestParams: {
            path: z.object({ productId: resourceId }),
            query: paginationSchema,
          },
          responses: {
            200: {
              description: 'Reviews',
              content: json(reviewListResponseSchema, {
                items: [],
                page: { ...pageExample, total: 0 },
              }),
            },
            400: appErrors(
              'Invalid tenant, product identifier, or pagination',
              reviewErrorCodes.listRequest,
              { INVALID_REQUEST: reviewInvalidRequestExamples.list },
            ),
          },
        },
        post: {
          tags: ['Commerce'],
          summary: 'Create or update a verified-buyer review',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: { path: z.object({ productId: resourceId }) },
          requestBody: {
            required: true,
            content: json(createReviewRequestSchema, {
              rating: 5,
              comment: 'Excellent product',
            }),
          },
          responses: {
            201: {
              description: 'Review',
              content: json(reviewResponseSchema, {
                _id: productExample._id,
                tenantId: 'mercadozetta',
                product: productExample._id,
                author: userExample._id,
                rating: 5,
                comment: 'Excellent product',
                createdAt: '2026-01-15T12:00:00.000Z',
                updatedAt: '2026-01-15T12:00:00.000Z',
              }),
            },
            400: appErrors(
              'Invalid tenant, product identifier, or review payload',
              reviewErrorCodes.createRequest,
              { INVALID_REQUEST: reviewInvalidRequestExamples.create },
            ),
            401: appErrors(
              'Missing or invalid session',
              reviewErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin, CSRF, self-review, or purchase validation failed',
              reviewErrorCodes.authorization,
            ),
            404: appErrors(
              'Product not found',
              reviewErrorCodes.productNotFound,
            ),
          },
        },
      },
      '/notifications': {
        get: {
          tags: ['Commerce'],
          summary: 'List current user notifications',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          requestParams: { query: paginationSchema },
          responses: {
            200: {
              description: 'Notifications',
              content: json(notificationListResponseSchema, {
                items: [],
                page: { ...pageExample, total: 0 },
              }),
            },
            400: appErrors(
              'Invalid tenant or pagination',
              notificationErrorCodes.listRequest,
              { INVALID_REQUEST: notificationInvalidRequestExamples.list },
            ),
            401: appErrors(
              'Missing or invalid session',
              notificationErrorCodes.authentication,
            ),
          },
        },
      },
      '/notifications/unread-count': {
        get: {
          tags: ['Commerce'],
          summary: 'Count current user unread notifications',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader],
          responses: {
            200: {
              description: 'Unread notification count',
              content: json(unreadNotificationCountResponseSchema, {
                count: 2,
              }),
            },
            400: appErrors('Invalid tenant', notificationErrorCodes.tenant),
            401: appErrors(
              'Missing or invalid session',
              notificationErrorCodes.authentication,
            ),
          },
        },
      },
      '/notifications/{notificationId}': {
        patch: {
          tags: ['Commerce'],
          summary: 'Mark a current user notification as read or unread',
          security: [{ cookieAuth: [] }],
          parameters: [tenantHeader, csrfHeader],
          requestParams: {
            path: z.object({ notificationId: resourceId }),
          },
          requestBody: {
            required: true,
            content: json(notificationReadRequestSchema, { read: true }),
          },
          responses: {
            200: {
              description: 'Updated notification',
              content: json(notificationResponseSchema, {
                _id: productExample._id,
                tenantId: 'mercadozetta',
                user: userExample._id,
                message: 'Order created',
                read: true,
                createdAt: '2026-01-15T12:00:00.000Z',
                updatedAt: '2026-01-15T12:00:00.000Z',
              }),
            },
            400: appErrors(
              'Invalid tenant, notification identifier, or read-state payload',
              notificationErrorCodes.updateRequest,
              { INVALID_REQUEST: notificationInvalidRequestExamples.update },
            ),
            401: appErrors(
              'Missing or invalid session',
              notificationErrorCodes.authentication,
            ),
            403: appErrors(
              'Origin or CSRF validation failed',
              notificationErrorCodes.csrf,
            ),
            404: appErrors(
              'Owned notification not found',
              notificationErrorCodes.notFound,
            ),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: '__Host-mz_at' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: '__Secure-mz_rt' },
      },
    },
  });
}

export function serializeOpenApiDocument() {
  return `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`;
}
