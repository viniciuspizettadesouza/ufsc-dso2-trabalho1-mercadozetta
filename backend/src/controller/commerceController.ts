import type { Request, Response } from 'express';
import type { CommerceService } from '@/services/commerceService';
import type { OrderStatus } from '@/orderStatus';
import type { Pagination } from '@/pagination';
import type {
  OrderListData,
  SellerOperationsQuery,
} from '@/validators/commerceValidator';
import type {
  CheckoutOrderRequest,
  CheckoutSelection,
} from '@/validators/deliveryValidator';

const pagination = (req: Request) => req.validated?.query as Pagination;

const context = (req: Request) => ({
  userId: req.userId ?? '',
  tenantId: req.tenant?.id ?? '',
});

export function createCommerceController(service: CommerceService) {
  async function getCart(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(await service.getCart(userId, tenantId));
  }
  async function setCartItem(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    const body = req.validated?.body as { productId: string; quantity: number };
    res.send(
      await service.setCartItem(
        userId,
        tenantId,
        body.productId,
        body.quantity,
      ),
    );
  }
  async function removeCartItem(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(
      await service.removeCartItem(
        userId,
        tenantId,
        (req.validated?.params as { productId: string }).productId,
      ),
    );
  }
  async function listWatchlist(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(await service.listWatchlist(userId, tenantId));
  }
  async function addWatchlist(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res
      .status(201)
      .send(
        await service.addWatchlist(
          userId,
          tenantId,
          (req.validated?.params as { productId: string }).productId,
        ),
      );
  }
  async function removeWatchlist(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    await service.removeWatchlist(
      userId,
      tenantId,
      (req.validated?.params as { productId: string }).productId,
    );
    res.status(204).send();
  }
  async function createOrder(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res
      .status(201)
      .send(
        await service.createOrder(
          userId,
          tenantId,
          req.idempotencyKey ?? '',
          req.validated?.body as CheckoutOrderRequest,
        ),
      );
  }
  async function getCheckoutQuote(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(
      await service.getCheckoutQuote(
        userId,
        tenantId,
        req.validated?.body as CheckoutSelection,
      ),
    );
  }
  async function listOrders(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(
      await service.listOrders(
        userId,
        tenantId,
        req.validated?.query as OrderListData,
      ),
    );
  }
  async function updateOrderStatus(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    const { orderId } = req.validated?.params as { orderId: string };
    const { status } = req.validated?.body as { status: OrderStatus };
    res.send(
      await service.updateOrderStatus(userId, tenantId, orderId, status),
    );
  }
  async function getSellerOperations(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(
      await service.getSellerOperations(
        userId,
        tenantId,
        req.validated?.query as SellerOperationsQuery,
      ),
    );
  }
  async function listReviews(req: Request, res: Response) {
    res.send(
      await service.listReviews(
        req.tenant?.id ?? '',
        (req.validated?.params as { productId: string }).productId,
        pagination(req),
      ),
    );
  }
  async function createReview(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    const { productId } = req.validated?.params as { productId: string };
    const body = req.validated?.body as { rating: number; comment: string };
    res
      .status(201)
      .send(
        await service.createReview(
          userId,
          tenantId,
          productId,
          body.rating,
          body.comment,
          req.idempotencyKey ?? '',
        ),
      );
  }
  async function listNotifications(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send(
      await service.listNotifications(userId, tenantId, pagination(req)),
    );
  }
  async function countUnreadNotifications(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    res.send({
      count: await service.countUnreadNotifications(userId, tenantId),
    });
  }
  async function updateNotificationRead(req: Request, res: Response) {
    const { userId, tenantId } = context(req);
    const { notificationId } = req.validated?.params as {
      notificationId: string;
    };
    const { read } = req.validated?.body as { read: boolean };
    res.send(
      await service.updateNotificationRead(
        userId,
        tenantId,
        notificationId,
        read,
      ),
    );
  }

  return {
    getCart,
    setCartItem,
    removeCartItem,
    listWatchlist,
    addWatchlist,
    removeWatchlist,
    createOrder,
    getCheckoutQuote,
    listOrders,
    updateOrderStatus,
    getSellerOperations,
    listReviews,
    createReview,
    listNotifications,
    countUnreadNotifications,
    updateNotificationRead,
  };
}

export type CommerceController = ReturnType<typeof createCommerceController>;
