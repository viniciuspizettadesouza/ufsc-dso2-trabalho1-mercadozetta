import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { describe, expect, it } from 'vitest';
import {
  createOpenApiDocument,
  serializeOpenApiDocument,
} from '@/openapi/document';
import { createRoutes, type RouteDependencies } from '@/routes';

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
};

const documentPath = path.resolve(__dirname, '../../docs/openapi.json');
const checkedInDocument = fs.readFileSync(documentPath, 'utf8');
const document = createOpenApiDocument() as unknown as OpenApiDocument;
const handler = () => undefined;
const controller = new Proxy({}, { get: () => handler });
const authMiddleware: RequestHandler = (_req, _res, next) => next();
const routes = createRoutes({
  accountManagementController: controller,
  accountSecurityController: controller,
  authController: controller,
  userController: controller,
  productController: controller,
  commerceController: controller,
  authMiddleware,
  readiness: async () => ({
    ready: false,
    checks: { postgresql: 'disconnected' },
  }),
} as unknown as RouteDependencies);

function normalizeExpressPath(routePath: string) {
  return routePath.replace(/:([^/]+)/g, '{$1}');
}

function implementedOperations() {
  return routes.stack
    .flatMap((layer: any) => {
      if (!layer.route) return [];

      return Object.keys(layer.route.methods).map(
        (method) =>
          `${method.toLowerCase()} ${normalizeExpressPath(layer.route.path)}`,
      );
    })
    .sort();
}

function documentedOperations() {
  return Object.entries(document.paths)
    .flatMap(([routePath, pathItem]) =>
      Object.keys(pathItem)
        .filter((method) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(method),
        )
        .map((method) => `${method} ${routePath}`),
    )
    .sort();
}

describe('OpenAPI contract', () => {
  it('matches the deterministically generated document', () => {
    expect(checkedInDocument).toBe(serializeOpenApiDocument());
  });

  it('uses OpenAPI 3.1 and documents every implemented route exactly once', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(documentedOperations()).toEqual(implementedOperations());
  });

  it('includes request and response examples for API operations with payloads', () => {
    expect(document.paths['/auth/login'].post).toHaveProperty(
      'requestBody.content.application/json.example',
    );
    expect(document.paths['/auth/login'].post).toHaveProperty(
      'responses.200.content.application/json.example',
    );
    expect(
      document.paths['/auth/email-verification/requests'].post,
    ).toHaveProperty('requestBody.content.application/json.example');
    expect(
      document.paths['/auth/email-verification/requests'].post,
    ).toHaveProperty('responses.202.content.application/json.example');
    expect(
      document.paths['/auth/password-reset/confirmations'].post,
    ).toHaveProperty('requestBody.content.application/json.example');
    expect(document.paths['/account/profile'].patch).toHaveProperty(
      'requestBody.content.application/json.example',
    );
    expect(document.paths['/account/profile'].patch).toHaveProperty(
      'responses.200.content.application/json.example',
    );
    expect(document.paths['/account/email-changes'].post).toHaveProperty(
      'responses.202.content.application/json.example',
    );
    expect(
      document.paths['/auth/email-change/confirmations'].post,
    ).toHaveProperty('requestBody.content.application/json.example');
    expect(document.paths['/users'].post).toHaveProperty(
      'requestBody.content.application/json.example',
    );
    expect(document.paths['/products'].post).toHaveProperty(
      'requestBody.content.application/json.example',
    );
    expect(document.paths['/products/{productId}'].get).toHaveProperty(
      'responses.200.content.application/json.example',
    );
    expect(document.paths['/ready'].get).toHaveProperty(
      'responses.503.content.application/json.example',
    );
  });

  it('documents authenticated account management, cookie clearing, and exact errors', () => {
    const paths = document.paths as any;
    const operations = [
      paths['/account/profile'].patch,
      paths['/account/password-changes'].post,
      paths['/account/email-changes'].post,
      paths['/account/deactivation'].post,
    ];
    const errorResponses = [
      paths['/account/profile'].patch.responses[400],
      paths['/account/profile'].patch.responses[401],
      paths['/account/profile'].patch.responses[403],
      paths['/account/profile'].patch.responses[409],
      paths['/account/password-changes'].post.responses[400],
      paths['/account/password-changes'].post.responses[401],
      paths['/account/password-changes'].post.responses[403],
      paths['/account/password-changes'].post.responses[409],
      paths['/account/password-changes'].post.responses[429],
      paths['/account/email-changes'].post.responses[400],
      paths['/account/email-changes'].post.responses[401],
      paths['/account/email-changes'].post.responses[403],
      paths['/account/email-changes'].post.responses[409],
      paths['/account/email-changes'].post.responses[429],
      paths['/account/email-changes'].post.responses[503],
      paths['/account/deactivation'].post.responses[400],
      paths['/account/deactivation'].post.responses[401],
      paths['/account/deactivation'].post.responses[403],
      paths['/account/deactivation'].post.responses[409],
      paths['/account/deactivation'].post.responses[429],
      paths['/auth/email-change/confirmations'].post.responses[400],
      paths['/auth/email-change/confirmations'].post.responses[403],
      paths['/auth/email-change/confirmations'].post.responses[409],
      paths['/auth/email-change/confirmations'].post.responses[429],
      paths['/auth/email-change/confirmations'].post.responses[503],
    ];

    for (const operation of operations) {
      expect(operation.security).toEqual([{ cookieAuth: [] }]);
      expect(
        operation.parameters.map(({ name }: { name: string }) => name),
      ).toEqual(expect.arrayContaining(['X-Tenant-Id', 'X-CSRF-Token']));
    }
    expect(
      paths['/account/profile'].patch.responses[200].content['application/json']
        .schema.$ref,
    ).toBe('#/components/schemas/User');
    expect(
      paths['/account/password-changes'].post.responses[204].description,
    ).toContain('cookies cleared');
    expect(
      paths['/auth/email-change/confirmations'].post.responses[204].description,
    ).toContain('cookies cleared');
    expect(
      paths['/account/deactivation'].post.responses[204].description,
    ).toContain('cookies cleared');

    for (const response of errorResponses) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes)
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
    }
  });

  it('documents the implemented product wire shape and shared list envelope', () => {
    const productSchema = (document as any).components.schemas.Product;
    const productDetail = (document.paths['/products/{productId}'] as any).get
      .responses[200].content['application/json'];
    const productList = (document.paths['/products'] as any).get.responses[200]
      .content['application/json'];

    expect(productSchema.required).toEqual(
      expect.arrayContaining([
        '_id',
        'tenantId',
        'seller',
        'price',
        'category',
        'subcategory',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(productSchema.properties.seller).toMatchObject({
      type: 'string',
      format: 'uuid',
    });
    expect(productSchema.properties).toHaveProperty('sellerProfile');
    expect(productDetail.example.sellerProfile).toMatchObject({
      _id: productDetail.example.seller,
    });
    expect(productList.schema.properties).toHaveProperty('items');
    expect(productList.schema.properties.page.$ref).toBe(
      '#/components/schemas/PageInfo',
    );
  });

  it('uses one product mutation shape and enumerates every documented product error example', () => {
    const paths = document.paths as any;
    const productMutationResponses = [
      paths['/products'].post.responses[201],
      paths['/products/{productId}'].patch.responses[200],
      paths['/products/{productId}/inventory'].patch.responses[200],
      paths['/products/{productId}/status'].patch.responses[200],
    ];
    const errorResponses = [
      paths['/products'].get.responses[400],
      paths['/users/{userId}/products'].get.responses[400],
      paths['/products'].post.responses[400],
      paths['/products'].post.responses[401],
      paths['/products'].post.responses[403],
      paths['/products/{productId}'].get.responses[400],
      paths['/products/{productId}'].get.responses[404],
      paths['/products/{productId}'].patch.responses[400],
      paths['/products/{productId}'].patch.responses[401],
      paths['/products/{productId}'].patch.responses[403],
      paths['/products/{productId}'].patch.responses[404],
      paths['/products/{productId}/inventory'].patch.responses[400],
      paths['/products/{productId}/inventory'].patch.responses[401],
      paths['/products/{productId}/inventory'].patch.responses[403],
      paths['/products/{productId}/inventory'].patch.responses[404],
      paths['/products/{productId}/status'].patch.responses[400],
      paths['/products/{productId}/status'].patch.responses[401],
      paths['/products/{productId}/status'].patch.responses[403],
      paths['/products/{productId}/status'].patch.responses[404],
      paths['/products/{productId}/status'].patch.responses[409],
    ];

    for (const response of productMutationResponses) {
      expect(response.content['application/json'].schema.$ref).toBe(
        '#/components/schemas/Product',
      );
      expect(response.content['application/json'].example).toHaveProperty(
        '_id',
      );
      expect(response.content['application/json'].example).not.toHaveProperty(
        'newProduct',
      );
    }

    for (const response of errorResponses) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }

    expect(
      paths['/products/{productId}'].patch.responses[403].content[
        'application/json'
      ].schema.properties.code.enum,
    ).toContain('PRODUCT_FORBIDDEN');
    expect(
      paths['/products/{productId}/status'].patch.responses[409].content[
        'application/json'
      ].schema.properties.code.enum,
    ).toEqual([
      'PRODUCT_STATUS_TRANSITION_INVALID',
      'PRODUCT_INVENTORY_REQUIRED',
      'PRODUCT_PRICE_REQUIRED',
    ]);
  });

  it('documents the implemented user and session wire shapes with exact errors', () => {
    const paths = document.paths as any;
    const schemas = (document as any).components.schemas;
    const authStateResponses = [
      paths['/auth/login'].post.responses[200],
      paths['/auth/session'].get.responses[200],
    ];
    const userAuthErrorResponses = [
      paths['/auth/login'].post.responses[400],
      paths['/auth/login'].post.responses[401],
      paths['/auth/login'].post.responses[403],
      paths['/auth/login'].post.responses[429],
      paths['/auth/session'].get.responses[400],
      paths['/auth/session'].get.responses[401],
      paths['/auth/refresh'].post.responses[400],
      paths['/auth/refresh'].post.responses[401],
      paths['/auth/refresh'].post.responses[403],
      paths['/auth/refresh'].post.responses[409],
      paths['/auth/sessions'].get.responses[400],
      paths['/auth/sessions'].get.responses[401],
      paths['/auth/sessions/{sessionId}'].delete.responses[400],
      paths['/auth/sessions/{sessionId}'].delete.responses[401],
      paths['/auth/sessions/{sessionId}'].delete.responses[403],
      paths['/auth/sessions/{sessionId}'].delete.responses[404],
      paths['/auth/logout/current'].post.responses[400],
      paths['/auth/logout/current'].post.responses[401],
      paths['/auth/logout/current'].post.responses[403],
      paths['/auth/logout'].post.responses[400],
      paths['/auth/logout'].post.responses[401],
      paths['/auth/logout'].post.responses[403],
      paths['/users'].post.responses[400],
      paths['/users'].post.responses[429],
      paths['/users/{userId}'].get.responses[400],
      paths['/users/{userId}'].get.responses[404],
    ];

    expect(schemas.User.required).toEqual(
      expect.arrayContaining([
        '_id',
        'tenantId',
        'email',
        'username',
        'telephone',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(schemas.User.properties.username.anyOf).toContainEqual({
      type: 'null',
    });
    expect(schemas.User.properties.telephone.anyOf).toContainEqual({
      type: 'null',
    });
    expect(schemas.Session.required).toEqual(
      expect.arrayContaining([
        'id',
        'createdAt',
        'lastUsedAt',
        'expiresAt',
        'absoluteExpiresAt',
      ]),
    );

    for (const response of authStateResponses) {
      expect(response.content['application/json'].schema.$ref).toBe(
        '#/components/schemas/AuthStateResponse',
      );
    }
    expect(
      paths['/auth/sessions'].get.responses[200].content['application/json']
        .schema.$ref,
    ).toBe('#/components/schemas/SessionListResponse');
    expect(
      paths['/users'].post.responses[201].content['application/json'].schema
        .$ref,
    ).toBe('#/components/schemas/User');
    expect(
      paths['/users'].post.responses[201].content['application/json'].example,
    ).not.toHaveProperty('newUser');
    expect(paths['/auth/login'].post.responses).toHaveProperty('403');

    for (const response of userAuthErrorResponses) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }
  });

  it('uses one populated cart shape and enumerates every cart error example', () => {
    const paths = document.paths as any;
    const schemas = (document as any).components.schemas;
    const cartResponses = [
      paths['/cart'].get.responses[200],
      paths['/cart/items'].put.responses[200],
      paths['/cart/items/{productId}'].delete.responses[200],
    ];
    const cartErrorResponses = [
      paths['/cart'].get.responses[400],
      paths['/cart'].get.responses[401],
      paths['/cart/items'].put.responses[400],
      paths['/cart/items'].put.responses[401],
      paths['/cart/items'].put.responses[403],
      paths['/cart/items'].put.responses[404],
      paths['/cart/items'].put.responses[409],
      paths['/cart/items/{productId}'].delete.responses[400],
      paths['/cart/items/{productId}'].delete.responses[401],
      paths['/cart/items/{productId}'].delete.responses[403],
    ];

    expect(schemas.Cart.required).toEqual(['tenantId', 'buyer', 'items']);
    expect(schemas.Cart.properties).not.toHaveProperty('_id');
    expect(schemas.CartItem.properties.product.$ref).toBe(
      '#/components/schemas/Product',
    );
    expect(schemas.CartItem.properties.quantity.minimum).toBe(1);
    expect(
      paths['/cart/items'].put.requestBody.content['application/json'].schema
        .$ref,
    ).toBe('#/components/schemas/CartItemRequest');

    for (const response of cartResponses) {
      expect(response.content['application/json'].schema.$ref).toBe(
        '#/components/schemas/Cart',
      );
    }

    for (const response of cartErrorResponses) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }

    expect(
      paths['/cart/items'].put.responses[409].content['application/json'].schema
        .properties.code.enum,
    ).toEqual(['INSUFFICIENT_INVENTORY']);
  });

  it('uses one populated watchlist entry shape and exact errors', () => {
    const paths = document.paths as any;
    const schemas = (document as any).components.schemas;
    const watchlistErrors = [
      paths['/watchlist'].get.responses[400],
      paths['/watchlist'].get.responses[401],
      paths['/watchlist/{productId}'].put.responses[400],
      paths['/watchlist/{productId}'].put.responses[401],
      paths['/watchlist/{productId}'].put.responses[403],
      paths['/watchlist/{productId}'].put.responses[404],
      paths['/watchlist/{productId}'].delete.responses[400],
      paths['/watchlist/{productId}'].delete.responses[401],
      paths['/watchlist/{productId}'].delete.responses[403],
    ];

    expect(schemas.Watchlist.items.$ref).toBe(
      '#/components/schemas/WatchlistEntry',
    );
    expect(schemas.WatchlistEntry.required).toEqual(
      expect.arrayContaining([
        '_id',
        'tenantId',
        'user',
        'product',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(schemas.WatchlistEntry.properties.product.$ref).toBe(
      '#/components/schemas/Product',
    );
    expect(
      paths['/watchlist'].get.responses[200].content['application/json'].schema
        .$ref,
    ).toBe('#/components/schemas/Watchlist');
    expect(
      paths['/watchlist/{productId}'].put.responses[201].content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/WatchlistEntry');

    for (const response of watchlistErrors) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }
  });

  it('documents complete paginated reviews and every reachable review error', () => {
    const paths = document.paths as any;
    const schemas = (document as any).components.schemas;
    const reviewPath = paths['/products/{productId}/reviews'];
    const reviewErrors = [
      reviewPath.get.responses[400],
      reviewPath.post.responses[400],
      reviewPath.post.responses[401],
      reviewPath.post.responses[403],
      reviewPath.post.responses[404],
    ];

    expect(schemas.Review.required).toEqual(
      expect.arrayContaining([
        '_id',
        'tenantId',
        'product',
        'author',
        'rating',
        'comment',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(schemas.ReviewList.properties.items.items.$ref).toBe(
      '#/components/schemas/Review',
    );
    expect(schemas.ReviewList.properties.page.$ref).toBe(
      '#/components/schemas/PageInfo',
    );
    expect(
      reviewPath.get.responses[200].content['application/json'].schema.$ref,
    ).toBe('#/components/schemas/ReviewList');
    expect(
      reviewPath.post.requestBody.content['application/json'].schema.$ref,
    ).toBe('#/components/schemas/CreateReviewRequest');
    expect(
      reviewPath.post.responses[201].content['application/json'].schema.$ref,
    ).toBe('#/components/schemas/Review');

    for (const response of reviewErrors) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }

    expect(
      reviewPath.post.responses[403].content['application/json'].schema
        .properties.code.enum,
    ).toEqual([
      'INVALID_ORIGIN',
      'INVALID_CSRF_TOKEN',
      'REVIEW_FORBIDDEN',
      'REVIEW_PURCHASE_REQUIRED',
    ]);
  });

  it('documents complete notification boundaries and exact ownership errors', () => {
    const paths = document.paths as any;
    const schemas = (document as any).components.schemas;
    const notificationErrors = [
      paths['/notifications'].get.responses[400],
      paths['/notifications'].get.responses[401],
      paths['/notifications/unread-count'].get.responses[400],
      paths['/notifications/unread-count'].get.responses[401],
      paths['/notifications/{notificationId}'].patch.responses[400],
      paths['/notifications/{notificationId}'].patch.responses[401],
      paths['/notifications/{notificationId}'].patch.responses[403],
      paths['/notifications/{notificationId}'].patch.responses[404],
    ];

    expect(schemas.Notification.required).toEqual(
      expect.arrayContaining([
        '_id',
        'tenantId',
        'user',
        'message',
        'read',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(schemas.NotificationList.properties.items.items.$ref).toBe(
      '#/components/schemas/Notification',
    );
    expect(schemas.NotificationList.properties.page.$ref).toBe(
      '#/components/schemas/PageInfo',
    );
    expect(
      paths['/notifications'].get.responses[200].content['application/json']
        .schema.$ref,
    ).toBe('#/components/schemas/NotificationList');
    expect(
      paths['/notifications/unread-count'].get.responses[200].content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/UnreadNotificationCount');
    expect(
      paths['/notifications/{notificationId}'].patch.requestBody.content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/NotificationReadRequest');
    expect(
      paths['/notifications/{notificationId}'].patch.responses[200].content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/Notification');

    for (const response of notificationErrors) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }

    expect(
      paths['/notifications/{notificationId}'].patch.responses[404].content[
        'application/json'
      ].schema.properties.code.enum,
    ).toEqual(['NOTIFICATION_NOT_FOUND']);
  });

  it('documents one complete scoped order shape and every order error', () => {
    const paths = document.paths as any;
    const schemas = (document as any).components.schemas;
    const orderErrors = [
      paths['/orders'].get.responses[400],
      paths['/orders'].get.responses[401],
      paths['/orders'].post.responses[400],
      paths['/orders'].post.responses[401],
      paths['/orders'].post.responses[403],
      paths['/orders'].post.responses[409],
      paths['/orders/{orderId}/status'].patch.responses[400],
      paths['/orders/{orderId}/status'].patch.responses[401],
      paths['/orders/{orderId}/status'].patch.responses[403],
      paths['/orders/{orderId}/status'].patch.responses[404],
      paths['/orders/{orderId}/status'].patch.responses[409],
    ];

    expect(schemas.Order.required).toEqual(
      expect.arrayContaining([
        '_id',
        'tenantId',
        'buyer',
        'status',
        'pricingState',
        'subtotal',
        'discount',
        'shipping',
        'total',
        'statusHistory',
        'items',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(schemas.OrderItem.required).toEqual(
      expect.arrayContaining([
        'tenantId',
        'order',
        'product',
        'seller',
        'productName',
        'quantity',
        'pricingState',
        'unitPrice',
        'lineSubtotal',
      ]),
    );
    expect(schemas.OrderList.properties.items.items.$ref).toBe(
      '#/components/schemas/Order',
    );
    expect(schemas.OrderList.properties.page.$ref).toBe(
      '#/components/schemas/PageInfo',
    );
    expect(
      paths['/orders'].get.responses[200].content['application/json'].schema
        .$ref,
    ).toBe('#/components/schemas/OrderList');
    expect(
      paths['/orders'].post.responses[201].content['application/json'].schema
        .$ref,
    ).toBe('#/components/schemas/Order');
    expect(paths['/orders'].post.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: 'header',
          name: 'Idempotency-Key',
          required: true,
          schema: expect.objectContaining({ format: 'uuid' }),
        }),
      ]),
    );
    expect(
      paths['/orders/{orderId}/status'].patch.requestBody.content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/OrderStatusUpdateRequest');
    expect(
      paths['/orders/{orderId}/status'].patch.responses[200].content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/Order');

    for (const response of orderErrors) {
      const content = response.content['application/json'];
      const codes = content.schema.properties.code.enum;
      expect(Object.keys(content.examples).sort()).toEqual([...codes].sort());
      for (const code of codes) {
        expect(content.examples[code].value).toMatchObject({
          error: expect.any(String),
          code,
        });
      }
    }

    expect(
      paths['/orders/{orderId}/status'].patch.responses[403].content[
        'application/json'
      ].schema.properties.code.enum,
    ).toContain('ORDER_FORBIDDEN');
    expect(
      paths['/orders'].post.responses[409].content['application/json'].schema
        .properties.code.enum,
    ).toEqual(
      expect.arrayContaining([
        'INSUFFICIENT_INVENTORY',
        'PRODUCT_PRICE_REQUIRED',
        'ORDER_TOTAL_LIMIT_EXCEEDED',
      ]),
    );
    expect(schemas.SellerOperations.properties.summary.required).toEqual(
      expect.arrayContaining([
        'pricedOrderCount',
        'legacyUnpricedOrderCount',
        'grossRevenue',
      ]),
    );
  });
});
