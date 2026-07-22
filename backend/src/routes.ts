import express from 'express';
import type { RequestHandler } from 'express';
import type { AuthController } from '@/controller/authController';
import type { AccountSecurityController } from '@/controller/accountSecurityController';
import type { AccountManagementController } from '@/controller/accountManagementController';
import type { UserController } from '@/controller/userController';
import type { ProductController } from '@/controller/productController';
import type { CommerceController } from '@/controller/commerceController';
import type { DeliveryAddressController } from '@/controller/deliveryAddressController';
import asyncHandler from '@/middleware/asyncHandler';
import {
  requireAllowedOrigin,
  requireCsrf,
  validatePresentOrigin,
} from '@/middleware/csrf';
import {
  authRateLimiter,
  emailVerificationConfirmationRateLimiter,
  emailVerificationRequestRateLimiter,
  passwordResetConfirmationRateLimiter,
  passwordResetRequestRateLimiter,
  registerRateLimiter,
  accountDeactivationRateLimiter,
  emailChangeConfirmationRateLimiter,
  emailChangeRequestRateLimiter,
  passwordChangeRateLimiter,
} from '@/middleware/rateLimit';
import validateRequest from '@/middleware/validateRequest';
import { requireIdempotencyKey } from '@/middleware/idempotency';
import {
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
  validateUpdateProductPayload,
  validateProductStatusUpdate,
  validateProductInventoryUpdate,
} from '@/validators/productValidator';
import { validateCreateUserPayload } from '@/validators/userValidator';
import { validateLoginPayload } from '@/validators/authValidator';
import {
  validateAccountRequest,
  validateAccountTokenConfirmation,
  validatePasswordResetConfirmation,
} from '@/validators/accountSecurityValidator';
import { validatePagination } from '@/validators/paginationValidator';
import {
  validateAccountDeactivation,
  validateEmailChangeRequest,
  validatePasswordChange,
  validateProfileUpdate,
} from '@/validators/accountManagementValidator';
import {
  validateCartItem,
  validateNotificationRead,
  validateOrderStatus,
  validateResourceId,
  validateReview,
  validateOrderList,
  validateSellerOperations,
} from '@/validators/commerceValidator';
import {
  validateCheckoutOrderRequest,
  validateCheckoutSelection,
  validateDeliveryAddress,
} from '@/validators/deliveryValidator';

export type RouteDependencies = {
  accountManagementController: AccountManagementController;
  accountSecurityController: AccountSecurityController;
  authController: AuthController;
  userController: UserController;
  productController: ProductController;
  commerceController: CommerceController;
  deliveryAddressController: DeliveryAddressController;
  authMiddleware: RequestHandler;
  readiness: () => Promise<{
    ready: boolean;
    checks: Record<string, string>;
  }>;
};

export function createRoutes(dependencies: RouteDependencies) {
  const {
    accountManagementController: AccountManagementController,
    accountSecurityController: AccountSecurityController,
    authController: AuthController,
    userController: UserController,
    productController: ProductController,
    commerceController: CommerceController,
    deliveryAddressController: DeliveryAddressController,
    authMiddleware,
    readiness,
  } = dependencies;
  const routes = express.Router();

  routes.get('/', (req, res) => {
    res.json({ message: 'Welcome to zetta2k app' });
  });

  routes.get('/health', (req, res) => {
    res.status(200).send({ status: 'ok' });
  });

  routes.get(
    '/ready',
    asyncHandler(async (req, res) => {
      const result = await readiness();

      return res.status(result.ready ? 200 : 503).send({
        status: result.ready ? 'ready' : 'not_ready',
        checks: result.checks,
      });
    }),
  );

  routes.get(
    '/products',
    validateRequest({ query: validateProductFilters }),
    asyncHandler(ProductController.index),
  );

  routes.get(
    '/products/:productId',
    validateRequest({
      params: (params) => ({ productId: validateProductId(params.productId) }),
    }),
    asyncHandler(ProductController.detail),
  );

  routes.get(
    '/users/:userId',
    validateRequest({
      params: (params) => ({
        userId: validateSellerId(String(params.userId || '')),
      }),
    }),
    asyncHandler(UserController.sellerProfile),
  );

  routes.get(
    '/users/:userId/products',
    validateRequest({
      params: (params) => ({
        userId: validateSellerId(String(params.userId || params.userID || '')),
      }),
      query: validateProductFilters,
    }),
    asyncHandler(ProductController.listBySeller),
  );

  routes.post(
    '/users',
    registerRateLimiter,
    validateRequest({ body: validateCreateUserPayload }),
    asyncHandler(UserController.add),
  );

  routes.post(
    '/auth/login',
    authRateLimiter,
    validatePresentOrigin,
    validateRequest({ body: validateLoginPayload }),
    asyncHandler(AuthController.authenticate),
  );

  routes.post(
    '/auth/email-verification/requests',
    requireAllowedOrigin,
    AccountSecurityController.requireDelivery,
    emailVerificationRequestRateLimiter,
    validateRequest({ body: validateAccountRequest }),
    asyncHandler(AccountSecurityController.requestEmailVerification),
  );

  routes.post(
    '/auth/email-verification/confirmations',
    requireAllowedOrigin,
    AccountSecurityController.requireDelivery,
    emailVerificationConfirmationRateLimiter,
    validateRequest({ body: validateAccountTokenConfirmation }),
    asyncHandler(AccountSecurityController.confirmEmailVerification),
  );

  routes.post(
    '/auth/password-reset/requests',
    requireAllowedOrigin,
    AccountSecurityController.requireDelivery,
    passwordResetRequestRateLimiter,
    validateRequest({ body: validateAccountRequest }),
    asyncHandler(AccountSecurityController.requestPasswordReset),
  );

  routes.post(
    '/auth/password-reset/confirmations',
    requireAllowedOrigin,
    AccountSecurityController.requireDelivery,
    passwordResetConfirmationRateLimiter,
    validateRequest({ body: validatePasswordResetConfirmation }),
    asyncHandler(AccountSecurityController.confirmPasswordReset),
  );

  routes.post(
    '/auth/email-change/confirmations',
    requireAllowedOrigin,
    AccountManagementController.requireEmailDelivery,
    emailChangeConfirmationRateLimiter,
    validateRequest({ body: validateAccountTokenConfirmation }),
    asyncHandler(AccountManagementController.confirmEmailChange),
  );

  routes.get(
    '/auth/session',
    authMiddleware,
    asyncHandler(AuthController.session),
  );

  routes.post(
    '/auth/refresh',
    requireAllowedOrigin,
    requireCsrf,
    asyncHandler(AuthController.refresh),
  );

  routes.get(
    '/auth/sessions',
    authMiddleware,
    asyncHandler(AuthController.sessions),
  );

  routes.delete(
    '/auth/sessions/:sessionId',
    authMiddleware,
    requireAllowedOrigin,
    requireCsrf,
    validateRequest({
      params: (params) => ({ sessionId: validateResourceId(params.sessionId) }),
    }),
    asyncHandler(AuthController.revokeSession),
  );

  routes.post(
    '/auth/logout/current',
    authMiddleware,
    requireAllowedOrigin,
    requireCsrf,
    asyncHandler(AuthController.logoutCurrent),
  );

  routes.post(
    '/auth/logout',
    authMiddleware,
    requireCsrf,
    asyncHandler(AuthController.logout),
  );

  routes.patch(
    '/account/profile',
    authMiddleware,
    requireCsrf,
    validateRequest({ body: validateProfileUpdate }),
    asyncHandler(AccountManagementController.updateProfile),
  );
  routes.post(
    '/account/password-changes',
    authMiddleware,
    requireCsrf,
    passwordChangeRateLimiter,
    validateRequest({ body: validatePasswordChange }),
    asyncHandler(AccountManagementController.changePassword),
  );
  routes.post(
    '/account/email-changes',
    authMiddleware,
    requireCsrf,
    AccountManagementController.requireEmailDelivery,
    emailChangeRequestRateLimiter,
    validateRequest({ body: validateEmailChangeRequest }),
    asyncHandler(AccountManagementController.requestEmailChange),
  );
  routes.post(
    '/account/deactivation',
    authMiddleware,
    requireCsrf,
    accountDeactivationRateLimiter,
    validateRequest({ body: validateAccountDeactivation }),
    asyncHandler(AccountManagementController.deactivateAccount),
  );

  routes.post(
    '/products',
    authMiddleware,
    requireCsrf,
    requireIdempotencyKey,
    validateRequest({ body: validateCreateProductPayload }),
    asyncHandler(ProductController.add),
  );

  const productMutationParams = (params: Record<string, unknown>) => ({
    productId: validateProductId(params.productId as string),
  });
  routes.patch(
    '/products/:productId',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: productMutationParams,
      body: validateUpdateProductPayload,
    }),
    asyncHandler(ProductController.update),
  );
  routes.patch(
    '/products/:productId/status',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: productMutationParams,
      body: validateProductStatusUpdate,
    }),
    asyncHandler(ProductController.updateStatus),
  );
  routes.patch(
    '/products/:productId/inventory',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: productMutationParams,
      body: validateProductInventoryUpdate,
    }),
    asyncHandler(ProductController.updateInventory),
  );

  const resourceParams =
    (key: 'productId' | 'orderId' | 'notificationId') =>
    (params: Record<string, unknown>) => ({
      [key]: validateResourceId(params[key]),
    });

  routes.get('/cart', authMiddleware, asyncHandler(CommerceController.getCart));
  routes.get(
    '/account/addresses',
    authMiddleware,
    asyncHandler(DeliveryAddressController.list),
  );
  routes.post(
    '/account/addresses',
    authMiddleware,
    requireCsrf,
    validateRequest({ body: validateDeliveryAddress }),
    asyncHandler(DeliveryAddressController.create),
  );
  routes.put(
    '/account/addresses/:addressId',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: (params) => ({ addressId: validateResourceId(params.addressId) }),
      body: validateDeliveryAddress,
    }),
    asyncHandler(DeliveryAddressController.update),
  );
  routes.delete(
    '/account/addresses/:addressId',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: (params) => ({ addressId: validateResourceId(params.addressId) }),
    }),
    asyncHandler(DeliveryAddressController.delete),
  );
  routes.put(
    '/cart/items',
    authMiddleware,
    requireCsrf,
    validateRequest({ body: validateCartItem }),
    asyncHandler(CommerceController.setCartItem),
  );
  routes.delete(
    '/cart/items/:productId',
    authMiddleware,
    requireCsrf,
    validateRequest({ params: resourceParams('productId') }),
    asyncHandler(CommerceController.removeCartItem),
  );
  routes.get(
    '/watchlist',
    authMiddleware,
    asyncHandler(CommerceController.listWatchlist),
  );
  routes.put(
    '/watchlist/:productId',
    authMiddleware,
    requireCsrf,
    validateRequest({ params: resourceParams('productId') }),
    asyncHandler(CommerceController.addWatchlist),
  );
  routes.delete(
    '/watchlist/:productId',
    authMiddleware,
    requireCsrf,
    validateRequest({ params: resourceParams('productId') }),
    asyncHandler(CommerceController.removeWatchlist),
  );
  routes.get(
    '/orders',
    authMiddleware,
    validateRequest({ query: validateOrderList }),
    asyncHandler(CommerceController.listOrders),
  );
  routes.post(
    '/checkout/quote',
    authMiddleware,
    requireCsrf,
    validateRequest({ body: validateCheckoutSelection }),
    asyncHandler(CommerceController.getCheckoutQuote),
  );
  routes.post(
    '/orders',
    authMiddleware,
    requireCsrf,
    requireIdempotencyKey,
    validateRequest({ body: validateCheckoutOrderRequest }),
    asyncHandler(CommerceController.createOrder),
  );
  routes.get(
    '/seller/operations',
    authMiddleware,
    validateRequest({ query: validateSellerOperations }),
    asyncHandler(CommerceController.getSellerOperations),
  );
  routes.patch(
    '/orders/:orderId/status',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: resourceParams('orderId'),
      body: validateOrderStatus,
    }),
    asyncHandler(CommerceController.updateOrderStatus),
  );
  routes.get(
    '/products/:productId/reviews',
    validateRequest({
      params: resourceParams('productId'),
      query: validatePagination,
    }),
    asyncHandler(CommerceController.listReviews),
  );
  routes.post(
    '/products/:productId/reviews',
    authMiddleware,
    requireCsrf,
    requireIdempotencyKey,
    validateRequest({
      params: resourceParams('productId'),
      body: validateReview,
    }),
    asyncHandler(CommerceController.createReview),
  );
  routes.get(
    '/notifications/unread-count',
    authMiddleware,
    asyncHandler(CommerceController.countUnreadNotifications),
  );
  routes.get(
    '/notifications',
    authMiddleware,
    validateRequest({ query: validatePagination }),
    asyncHandler(CommerceController.listNotifications),
  );
  routes.patch(
    '/notifications/:notificationId',
    authMiddleware,
    requireCsrf,
    validateRequest({
      params: resourceParams('notificationId'),
      body: validateNotificationRead,
    }),
    asyncHandler(CommerceController.updateNotificationRead),
  );

  return routes;
}
