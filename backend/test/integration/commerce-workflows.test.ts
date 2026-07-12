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
  authorization,
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
    const auth = authorization(buyer._id);

    await request(app)
      .put('/cart/items')
      .set('Authorization', auth)
      .send({ productId: available._id, quantity: 2 })
      .expect(200);
    const cart = await request(app)
      .get('/cart')
      .set('Authorization', auth)
      .expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0]).toMatchObject({ quantity: 2 });

    for (const product of [unavailable, otherTenantProduct]) {
      const response = await request(app)
        .put('/cart/items')
        .set('Authorization', auth)
        .send({ productId: product._id, quantity: 1 });
      expect([404, 409]).toContain(response.status);
    }

    await request(app)
      .put(`/watchlist/${available._id}`)
      .set('Authorization', auth)
      .expect(201);
    await request(app)
      .put(`/watchlist/${available._id}`)
      .set('Authorization', auth)
      .expect(201);
    const watchlist = await request(app)
      .get('/watchlist')
      .set('Authorization', auth)
      .expect(200);
    expect(watchlist.body).toHaveLength(1);
    expect(await Watchlist.countDocuments({ tenantId, user: buyer._id })).toBe(
      1,
    );

    await request(app)
      .delete(`/watchlist/${available._id}`)
      .set('Authorization', auth)
      .expect(204);
    await request(app)
      .delete(`/cart/items/${available._id}`)
      .set('Authorization', auth)
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

    const checkout = await request(app)
      .post('/orders')
      .set('Authorization', authorization(buyer._id))
      .expect(201);
    const orderId = checkout.body._id;

    const sellerOrders = await request(app)
      .get('/orders')
      .set('Authorization', authorization(seller._id))
      .expect(200);
    expect(sellerOrders.body).toHaveLength(1);
    const outsiderOrders = await request(app)
      .get('/orders')
      .set('Authorization', authorization(outsider._id))
      .expect(200);
    expect(outsiderOrders.body).toEqual([]);

    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', authorization(outsider._id))
      .send({ status: 'shipped' })
      .expect(403);
    await request(app)
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', authorization(seller._id))
      .send({ status: 'shipped' })
      .expect(200);
    expect((await Order.findById(orderId))?.status).toBe('shipped');

    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set('Authorization', authorization(outsider._id))
      .send({ rating: 5, comment: 'Not purchased' })
      .expect(403);
    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set('Authorization', authorization(seller._id))
      .send({ rating: 5, comment: 'Own product' })
      .expect(403);
    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set('Authorization', authorization(buyer._id))
      .send({ rating: 4, comment: 'Good' })
      .expect(201);
    await request(app)
      .post(`/products/${product._id}/reviews`)
      .set('Authorization', authorization(buyer._id))
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
      .set('Authorization', authorization(seller._id))
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
