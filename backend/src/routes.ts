import express from 'express';
import mongoose from 'mongoose';
import AuthController from './controller/authController';
import UserController from './controller/userController';
import ProductController from './controller/productController';
import authMiddleware from './middleware/auth';
import asyncHandler from './middleware/asyncHandler';
import { authRateLimiter, registerRateLimiter } from './middleware/rateLimit';
import validateRequest from './middleware/validateRequest';
import {
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
} from './validators/productValidator';
import { validateCreateUserPayload } from './validators/userValidator';
import { validateLoginPayload } from './validators/authValidator';

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
  asyncHandler(ProductController.index)
);

routes.get(
  '/products/:productId',
  validateRequest({
    params: params => ({ productId: validateProductId(params.productId) }),
  }),
  asyncHandler(ProductController.detail)
);

routes.get('/users/:userId', asyncHandler(UserController.sellerProfile));

routes.get(
  '/users/:userId/products',
  validateRequest({
    params: params => ({ userId: validateSellerId(String(params.userId || params.userID || '')) }),
    query: validateProductFilters,
  }),
  asyncHandler(ProductController.listBySeller)
);

routes.post(
  '/users',
  registerRateLimiter,
  validateRequest({ body: validateCreateUserPayload }),
  asyncHandler(UserController.add)
);

routes.post(
  '/auth/login',
  authRateLimiter,
  validateRequest({ body: validateLoginPayload }),
  asyncHandler(AuthController.authenticate)
);

routes.post(
  '/products',
  authMiddleware,
  validateRequest({ body: validateCreateProductPayload }),
  asyncHandler(ProductController.add)
);

export default routes;
