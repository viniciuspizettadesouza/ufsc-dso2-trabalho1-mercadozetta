import request from 'supertest';
import app from '@/app';
import Cart from '@/model/cart';
import Notification from '@/model/notification';
import Order from '@/model/order';
import Product from '@/model/product';
import Review from '@/model/review';
import User from '@/model/user';
import Watchlist from '@/model/watchlist';
import {
  sessionHeaders,
  clearDatabase,
  connectDatabase,
  disconnectDatabase,
} from './helpers/database';

const tenantId = 'mercadozetta';

describe('persistent commerce workflows', () => {
  beforeAll(connectDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectDatabase);

  it('persists cart and watchlist changes and rejects unavailable products', async () => {
    const [seller, buyer] = await User.create([
      { tenantId, email: 'seller@example.com', password: 'password123' },
      { tenantId, email: 'buyer@example.com', password: 'password123' },
    ]);
    const [available, unavailable, otherTenantProduct] = await Product.create([
      {
        tenantId,
        name: 'available',
        inventory: 3,
        image: 'https://example.com/available.png',
        seller: seller._id,
      },
      {
        tenantId,
        name: 'unavailable',
        inventory: 0,
        image: 'https://example.com/unavailable.png',
        seller: seller._id,
      },
      {
        tenantId: 'campus-market',
        name: 'isolated',
        inventory: 3,
        image: 'https://example.com/isolated.png',
        seller: seller._id,
      },
    ]);
    const auth = await sessionHeaders(buyer._id);

    await request(app)
      .put('/cart/items')
      .set(auth)
      .send({ productId: available._id, quantity: 2 })
      .expect(200);
    const cart = await request(app).get('/cart').set(auth).expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0]).toMatchObject({ quantity: 2 });

    for (const product of [unavailable, otherTenantProduct]) {
      const response = await request(app)
        .put('/cart/items')
        .set(auth)
        .send({ productId: product._id, quantity: 1 });
      expect([404, 409]).toContain(response.status);
    }

    await request(app).put(`/watchlist/${available._id}`).set(auth).expect(201);
    await request(app).put(`/watchlist/${available._id}`).set(auth).expect(201);
    const watchlist = await request(app)
      .get('/watchlist')
      .set(auth)
      .expect(200);
    expect(watchlist.body).toHaveLength(1);
    expect(await Watchlist.countDocuments({ tenantId, user: buyer._id })).toBe(
      1,
    );

    await request(app)
      .delete(`/watchlist/${available._id}`)
      .set(auth)
      .expect(204);
    await request(app)
      .delete(`/cart/items/${available._id}`)
      .set(auth)
      .expect(200);
    expect((await Cart.findOne({ buyer: buyer._id }))?.items).toHaveLength(0);
  });

  it('enforces order visibility, fulfillment, reviews, and notifications', async () => {
    const [seller, buyer, outsider] = await User.create([
      { tenantId, email: 'seller@example.com', password: 'password123' },
      { tenantId, email: 'buyer@example.com', password: 'password123' },
      { tenantId, email: 'outsider@example.com', password: 'password123' },
    ]);
    const product = await Product.create({
      tenantId,
      name: 'purchased product',
      inventory: 2,
      image: 'https://example.com/product.png',
      seller: seller._id,
    });
    await Cart.create({
      tenantId,
      buyer: buyer._id,
      items: [{ product: product._id, quantity: 1 }],
    });
    const buyerAuth = await sessionHeaders(buyer._id);
    const sellerAuth = await sessionHeaders(seller._id);
    const outsiderAuth = await sessionHeaders(outsider._id);

    const checkout = await request(app)
      .post('/orders')
      .set(buyerAuth)
      .expect(201);
    const orderId = checkout.body._id;

    const sellerOrders = await request(app)
      .get('/orders')
      .set(sellerAuth)
      .expect(200);
    expect(sellerOrders.body).toHaveLength(1);
    const outsiderOrders = await request(app)
      .get('/orders')
      .set(outsiderAuth)
      .expect(200);
    expect(outsiderOrders.body).toEqual([]);

    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(outsiderAuth)
      .send({ status: 'shipped' })
      .expect(403);
    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(sellerAuth)
      .send({ status: 'shipped' })
      .expect(409);
    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(sellerAuth)
      .send({ status: 'confirmed' })
      .expect(200);
    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(sellerAuth)
      .send({ status: 'shipped' })
      .expect(200);
    const storedOrder = await Order.findById(orderId);
    expect(storedOrder?.status).toBe('shipped');
    expect(
      storedOrder?.statusHistory.map(({ status, actor }) => ({
        status,
        actor: String(actor),
      })),
    ).toEqual([
      { status: 'placed', actor: String(buyer._id) },
      { status: 'confirmed', actor: String(seller._id) },
      { status: 'shipped', actor: String(seller._id) },
    ]);

    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set(outsiderAuth)
      .send({ rating: 5, comment: 'Not purchased' })
      .expect(403);
    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set(sellerAuth)
      .send({ rating: 5, comment: 'Own product' })
      .expect(403);
    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set(buyerAuth)
      .send({ rating: 4, comment: 'Good' })
      .expect(201);
    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set(buyerAuth)
      .send({ rating: 5, comment: 'Excellent' })
      .expect(201);
    expect(
      await Review.countDocuments({ tenantId, product: product._id }),
    ).toBe(1);
    expect((await Review.findOne({ product: product._id }))?.comment).toBe(
      'Excellent',
    );

    const sellerNotifications = await request(app)
      .get('/notifications')
      .set(sellerAuth)
      .expect(200);
    expect(
      sellerNotifications.body.map(
        ({ message }: { message: string }) => message,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('New order'),
        'New review for purchased product',
      ]),
    );
    await request(app)
      .get('/notifications/unread-count')
      .set(sellerAuth)
      .expect(200, { count: sellerNotifications.body.length });
    const notificationId = sellerNotifications.body[0]._id;
    await request(app)
      .patch(`/notifications/${notificationId}`)
      .set(buyerAuth)
      .send({ read: true })
      .expect(404);
    await request(app)
      .patch(`/notifications/${notificationId}`)
      .set(sellerAuth)
      .send({ read: true })
      .expect(200)
      .expect(({ body }) => expect(body.read).toBe(true));
    await request(app)
      .get('/notifications/unread-count')
      .set(sellerAuth)
      .expect(200, { count: sellerNotifications.body.length - 1 });
    const buyerNotifications = await Notification.find({
      tenantId,
      user: buyer._id,
    });
    expect(buyerNotifications.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('created'),
        expect.stringContaining('is now shipped'),
      ]),
    );
  });
});
