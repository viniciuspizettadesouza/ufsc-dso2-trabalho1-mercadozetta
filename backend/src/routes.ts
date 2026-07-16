import express from 'express';
import mongoose from 'mongoose';
import AuthController from '@/controller/authController';
import UserController from '@/controller/userController';
import ProductController from '@/controller/productController';
import CommerceController from '@/controller/commerceController';
import authMiddleware from '@/middleware/auth';
import asyncHandler from '@/middleware/asyncHandler';
import {
  requireAllowedOrigin,
  requireCsrf,
  validatePresentOrigin,
} from '@/middleware/csrf';
import { authRateLimiter, registerRateLimiter } from '@/middleware/rateLimit';
import validateRequest from '@/middleware/validateRequest';
import {
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
} from '@/validators/productValidator';
import { validateCreateUserPayload } from '@/validators/userValidator';
import { validateLoginPayload } from '@/validators/authValidator';
import {
  validateCartItem,
  validateNotificationRead,
  validateOrderStatus,
  validateResourceId,
  validateReview,
} from '@/validators/commerceValidator';

const routes = express.Router();

routes.get('/', (req, res) => {
  res.json({ message: 'Welcome to zetta2k app' });
});

routes.get('/health', (req, res) => {
  res.status(200).send({ status: 'ok' });
});

routes.get('/ready', (req, res) => {
  const isReady = mongoose.connection.readyState === 1;

  return res.status(isReady ? 200 : 503).send({
    status: isReady ? 'ready' : 'not_ready',
    checks: {
      mongodb: isReady ? 'connected' : 'disconnected',
    },
  });
});

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

routes.get('/users/:userId', asyncHandler(UserController.sellerProfile));

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

routes.post(
  '/products',
  authMiddleware,
  requireCsrf,
  validateRequest({ body: validateCreateProductPayload }),
  asyncHandler(ProductController.add),
);

const resourceParams =
  (key: 'productId' | 'orderId' | 'notificationId') =>
  (params: Record<string, unknown>) => ({
    [key]: validateResourceId(params[key]),
  });

routes.get('/cart', authMiddleware, asyncHandler(CommerceController.getCart));
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
  asyncHandler(CommerceController.listOrders),
);
routes.post(
  '/orders',
  authMiddleware,
  requireCsrf,
  asyncHandler(CommerceController.createOrder),
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
  validateRequest({ params: resourceParams('productId') }),
  asyncHandler(CommerceController.listReviews),
);
routes.post(
  '/products/:productId/reviews',
  authMiddleware,
  requireCsrf,
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

export default routes;
