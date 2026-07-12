import type { Request, Response } from 'express';
import * as Commerce from '../services/commerceService';
import type { OrderStatus } from '../orderStatus';

const context = (req: Request) => ({
  userId: req.userId ?? '',
  tenantId: req.tenant?.id ?? '',
});

export async function getCart(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res.send(await Commerce.getCart(userId, tenantId));
}
export async function setCartItem(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  const body = req.validated?.body as { productId: string; quantity: number };
  res.send(
    await Commerce.setCartItem(userId, tenantId, body.productId, body.quantity),
  );
}
export async function removeCartItem(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res.send(
    await Commerce.removeCartItem(
      userId,
      tenantId,
      (req.validated?.params as { productId: string }).productId,
    ),
  );
}
export async function listWatchlist(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res.send(await Commerce.listWatchlist(userId, tenantId));
}
export async function addWatchlist(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res
    .status(201)
    .send(
      await Commerce.addWatchlist(
        userId,
        tenantId,
        (req.validated?.params as { productId: string }).productId,
      ),
    );
}
export async function removeWatchlist(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  await Commerce.removeWatchlist(
    userId,
    tenantId,
    (req.validated?.params as { productId: string }).productId,
  );
  res.status(204).send();
}
export async function createOrder(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res.status(201).send(await Commerce.createOrder(userId, tenantId));
}
export async function listOrders(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res.send(await Commerce.listOrders(userId, tenantId));
}
export async function updateOrderStatus(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  const { orderId } = req.validated?.params as { orderId: string };
  const { status } = req.validated?.body as { status: OrderStatus };
  res.send(await Commerce.updateOrderStatus(userId, tenantId, orderId, status));
}
export async function listReviews(req: Request, res: Response) {
  res.send(
    await Commerce.listReviews(
      req.tenant?.id ?? '',
      (req.validated?.params as { productId: string }).productId,
    ),
  );
}
export async function createReview(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  const { productId } = req.validated?.params as { productId: string };
  const body = req.validated?.body as { rating: number; comment: string };
  res
    .status(201)
    .send(
      await Commerce.createReview(
        userId,
        tenantId,
        productId,
        body.rating,
        body.comment,
      ),
    );
}
export async function listNotifications(req: Request, res: Response) {
  const { userId, tenantId } = context(req);
  res.send(await Commerce.listNotifications(userId, tenantId));
}

export default {
  getCart,
  setCartItem,
  removeCartItem,
  listWatchlist,
  addWatchlist,
  removeWatchlist,
  createOrder,
  listOrders,
  updateOrderStatus,
  listReviews,
  createReview,
  listNotifications,
};
