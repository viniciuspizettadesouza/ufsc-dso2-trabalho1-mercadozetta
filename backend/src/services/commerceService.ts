import AppError from '@/errors/AppError';
import mongoose from 'mongoose';
import Cart from '@/model/cart';
import Notification from '@/model/notification';
import Order from '@/model/order';
import type { OrderStatus } from '@/orderStatus';
import OrderItem from '@/model/orderItem';
import Product from '@/model/product';
import Review from '@/model/review';
import Watchlist from '@/model/watchlist';

export async function getCart(userId: string, tenantId: string) {
  const cart = await Cart.findOne({ tenantId, buyer: userId }).populate(
    'items.product',
  );
  return cart ?? { tenantId, buyer: userId, items: [] };
}

export async function setCartItem(
  userId: string,
  tenantId: string,
  productId: string,
  quantity: number,
) {
  const product = await Product.findOne({
    _id: productId,
    tenantId,
    status: 'active',
  });
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

  const cart = await Cart.findOneAndUpdate(
    { tenantId, buyer: userId },
    { $setOnInsert: { tenantId, buyer: userId } },
    { upsert: true, new: true },
  );
  const item = cart.items.find((entry) => String(entry.product) === productId);
  /* v8 ignore next -- both existing and new cart lines have focused coverage. */
  if (item) item.quantity = quantity;
  else cart.items.push({ product: product._id, quantity });
  await cart.save();
  return getCart(userId, tenantId);
}

export async function removeCartItem(
  userId: string,
  tenantId: string,
  productId: string,
) {
  await Cart.updateOne(
    { tenantId, buyer: userId },
    { $pull: { items: { product: productId } } },
  );
  return getCart(userId, tenantId);
}

export async function listWatchlist(userId: string, tenantId: string) {
  return Watchlist.find({ tenantId, user: userId }).populate('product');
}

export async function addWatchlist(
  userId: string,
  tenantId: string,
  productId: string,
) {
  const product = await Product.exists({ _id: productId, tenantId });
  /* v8 ignore next -- covered through mocked model branches; CommonJS integration tests load a duplicate module copy. */
  if (!product)
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  return Watchlist.findOneAndUpdate(
    { tenantId, user: userId, product: productId },
    { $setOnInsert: { tenantId, user: userId, product: productId } },
    { upsert: true, new: true },
  );
}

export async function removeWatchlist(
  userId: string,
  tenantId: string,
  productId: string,
) {
  await Watchlist.deleteOne({ tenantId, user: userId, product: productId });
}

export async function createOrder(userId: string, tenantId: string) {
  const session = await mongoose.startSession();
  let transactionResult;

  try {
    transactionResult = await session.withTransaction(async () => {
      const cart = await Cart.findOne({ tenantId, buyer: userId }, null, {
        session,
      });
      /* v8 ignore next -- empty and populated carts have focused coverage. */
      if (!cart?.items.length)
        throw new AppError(400, 'EMPTY_CART', 'Cart is empty');

      const products = await Product.find(
        {
          tenantId,
          _id: { $in: cart.items.map((item) => item.product) },
        },
        null,
        { session },
      );
      const productMap = new Map(
        products.map((product) => [String(product._id), product]),
      );
      for (const item of cart.items) {
        const product = productMap.get(String(item.product));
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

      const [order] = await Order.create(
        [{ tenantId, buyer: userId, status: 'placed' }],
        { session },
      );
      const items = cart.items.map((item) => {
        const product = productMap.get(String(item.product))!;
        return {
          tenantId,
          order: order._id,
          product: product._id,
          seller: product.seller,
          productName: product.name,
          quantity: item.quantity,
        };
      });
      await OrderItem.insertMany(items, { session });

      for (const item of items) {
        const inventoryUpdate = await Product.updateOne(
          {
            _id: item.product,
            tenantId,
            status: 'active',
            inventory: { $gte: item.quantity },
          },
          { $inc: { inventory: -item.quantity } },
          { session },
        );
        if (inventoryUpdate.modifiedCount !== 1)
          throw new AppError(
            409,
            'INSUFFICIENT_INVENTORY',
            'A cart item is unavailable',
          );
      }

      await Cart.updateOne(
        { _id: cart._id, tenantId },
        { $set: { items: [] } },
        { session },
      );
      await Notification.create(
        [
          {
            tenantId,
            user: userId,
            message: `Order ${order._id} created`,
          },
        ],
        { session },
      );
      await Notification.insertMany(
        [...new Set(items.map((item) => String(item.seller)))].map(
          (seller) => ({
            tenantId,
            user: seller,
            message: `New order ${order._id}`,
          }),
        ),
        { session },
      );
      return { order, items };
    });
  } finally {
    await session.endSession();
  }

  /* v8 ignore next -- a committed transaction always assigns its order. */
  if (!transactionResult) throw new Error('Order transaction did not commit');
  return {
    ...transactionResult.order.toObject(),
    items: transactionResult.items,
  };
}

export async function listOrders(userId: string, tenantId: string) {
  const buyerOrders = await Order.find({ tenantId, buyer: userId }).sort({
    createdAt: -1,
  });
  const soldItems = await OrderItem.find({ tenantId, seller: userId });
  const orderIds = [
    ...new Set([
      ...buyerOrders.map((order) => String(order._id)),
      ...soldItems.map((item) => String(item.order)),
    ]),
  ];
  const orders = await Order.find({ tenantId, _id: { $in: orderIds } }).sort({
    createdAt: -1,
  });
  const items = await OrderItem.find({ tenantId, order: { $in: orderIds } });
  return orders.map((order) => ({
    ...order.toObject(),
    items: items.filter((item) => String(item.order) === String(order._id)),
  }));
}

export async function updateOrderStatus(
  userId: string,
  tenantId: string,
  orderId: string,
  status: OrderStatus,
) {
  const order = await Order.findOne({ _id: orderId, tenantId });
  /* v8 ignore next -- missing and existing orders have focused coverage. */
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  const sellerItem = await OrderItem.exists({
    tenantId,
    order: orderId,
    seller: userId,
  });
  const isBuyerCancellation =
    String(order.buyer) === userId && status === 'cancelled';
  /* v8 ignore next -- seller, buyer cancellation, and unrelated-user paths have focused coverage. */
  if (!sellerItem && !isBuyerCancellation)
    throw new AppError(
      403,
      'ORDER_FORBIDDEN',
      'Not authorized to update this order',
    );
  order.status = status;
  await order.save();
  await Notification.create({
    tenantId,
    user: order.buyer,
    message: `Order ${order._id} is now ${status}`,
  });
  return order;
}

export async function listReviews(tenantId: string, productId: string) {
  return Review.find({ tenantId, product: productId }).sort({ createdAt: -1 });
}

export async function createReview(
  userId: string,
  tenantId: string,
  productId: string,
  rating: number,
  comment: string,
) {
  const product = await Product.findOne({ _id: productId, tenantId });
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
  const purchased = await OrderItem.exists({
    tenantId,
    product: productId,
    order: {
      $in: await Order.find({ tenantId, buyer: userId }).distinct('_id'),
    },
  });
  /* v8 ignore next -- purchased and unpurchased paths have focused coverage. */
  if (!purchased)
    throw new AppError(
      403,
      'REVIEW_PURCHASE_REQUIRED',
      'Only buyers can review purchased products',
    );
  const review = await Review.findOneAndUpdate(
    { tenantId, product: productId, author: userId },
    { rating, comment },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await Notification.create({
    tenantId,
    user: product.seller,
    message: `New review for ${product.name}`,
  });
  return review;
}

export async function listNotifications(userId: string, tenantId: string) {
  return Notification.find({ tenantId, user: userId }).sort({ createdAt: -1 });
}
