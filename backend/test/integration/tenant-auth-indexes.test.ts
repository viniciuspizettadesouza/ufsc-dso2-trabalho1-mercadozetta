import request from 'supertest';
import app from '@/app';
import Cart from '@/model/cart';
import Notification from '@/model/notification';
import Order from '@/model/order';
import OrderItem from '@/model/orderItem';
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

const registration = {
  email: 'shared@example.com',
  password: 'password123',
  username: 'Shared User',
  telephone: '555-0100',
};

describe('tenant, authentication, and index persistence', () => {
  beforeAll(connectDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectDatabase);

  it('enforces tenant-bound duplicate and compound indexes', async () => {
    await request(app)
      .post('/users')
      .set('X-Tenant-Id', 'mercadozetta')
      .send(registration)
      .expect(201);
    await request(app)
      .post('/users')
      .set('X-Tenant-Id', 'campus-market')
      .send(registration)
      .expect(201);
    const duplicate = await request(app)
      .post('/users')
      .set('X-Tenant-Id', 'mercadozetta')
      .send(registration)
      .expect(400);
    expect(duplicate.body.code).toBe('USER_EXISTS');

    const [user, seller] = await User.find({ tenantId: 'mercadozetta' });
    const product = await Product.create({
      tenantId: 'mercadozetta',
      name: 'indexed product',
      inventory: 1,
      image: 'https://example.com/indexed.png',
      seller: seller?._id ?? user._id,
    });
    await Watchlist.create({
      tenantId: 'mercadozetta',
      user: user._id,
      product: product._id,
    });
    await expect(
      Watchlist.create({
        tenantId: 'mercadozetta',
        user: user._id,
        product: product._id,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    await Watchlist.create({
      tenantId: 'campus-market',
      user: user._id,
      product: product._id,
    });
  });

  it('keeps every commerce collection scoped to its tenant', async () => {
    const [marketUser, campusUser] = await User.create([
      {
        tenantId: 'mercadozetta',
        email: 'market@example.com',
        password: 'password123',
      },
      {
        tenantId: 'campus-market',
        email: 'campus@example.com',
        password: 'password123',
      },
    ]);
    const [marketProduct, campusProduct] = await Product.create([
      {
        tenantId: 'mercadozetta',
        name: 'market product',
        inventory: 1,
        image: 'https://example.com/market.png',
        seller: marketUser._id,
      },
      {
        tenantId: 'campus-market',
        name: 'campus product',
        inventory: 1,
        image: 'https://example.com/campus.png',
        seller: campusUser._id,
      },
    ]);
    const [marketOrder, campusOrder] = await Order.create([
      { tenantId: 'mercadozetta', buyer: marketUser._id },
      { tenantId: 'campus-market', buyer: campusUser._id },
    ]);

    await Promise.all([
      Cart.create({
        tenantId: 'mercadozetta',
        buyer: marketUser._id,
        items: [{ product: marketProduct._id, quantity: 1 }],
      }),
      Cart.create({
        tenantId: 'campus-market',
        buyer: campusUser._id,
        items: [{ product: campusProduct._id, quantity: 1 }],
      }),
      Watchlist.create({
        tenantId: 'mercadozetta',
        user: marketUser._id,
        product: marketProduct._id,
      }),
      Watchlist.create({
        tenantId: 'campus-market',
        user: campusUser._id,
        product: campusProduct._id,
      }),
      OrderItem.create({
        tenantId: 'mercadozetta',
        order: marketOrder._id,
        product: marketProduct._id,
        seller: marketUser._id,
        productName: marketProduct.name,
        quantity: 1,
      }),
      OrderItem.create({
        tenantId: 'campus-market',
        order: campusOrder._id,
        product: campusProduct._id,
        seller: campusUser._id,
        productName: campusProduct.name,
        quantity: 1,
      }),
      Review.create({
        tenantId: 'mercadozetta',
        product: marketProduct._id,
        author: marketUser._id,
        rating: 5,
        comment: 'Market review',
      }),
      Review.create({
        tenantId: 'campus-market',
        product: campusProduct._id,
        author: campusUser._id,
        rating: 5,
        comment: 'Campus review',
      }),
      Notification.create({
        tenantId: 'mercadozetta',
        user: marketUser._id,
        message: 'Market notification',
      }),
      Notification.create({
        tenantId: 'campus-market',
        user: campusUser._id,
        message: 'Campus notification',
      }),
    ]);

    for (const model of [
      User,
      Product,
      Cart,
      Watchlist,
      Order,
      OrderItem,
      Review,
      Notification,
    ]) {
      expect(
        await model.collection.countDocuments({ tenantId: 'mercadozetta' }),
      ).toBe(1);
      expect(
        await model.collection.countDocuments({ tenantId: 'campus-market' }),
      ).toBe(1);
    }

    const crossTenantToken = await request(app)
      .get('/orders')
      .set('X-Tenant-Id', 'campus-market')
      .set('Authorization', authorization(marketUser._id, 'mercadozetta'))
      .expect(401);
    expect(crossTenantToken.body.code).toBe('INVALID_AUTH_TOKEN');
  });

  it('persists token versions and revokes a token on logout', async () => {
    const user = await User.create({
      tenantId: 'mercadozetta',
      email: 'login@example.com',
      password: 'password123',
      username: 'Login User',
      telephone: '555-0101',
    });
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'password123' })
      .expect(200);
    const auth = `Bearer ${login.body.token}`;

    await request(app).get('/cart').set('Authorization', auth).expect(200);
    await request(app)
      .post('/auth/logout')
      .set('Authorization', auth)
      .expect(204);
    expect(
      (await User.findById(user._id).select('+tokenVersion'))?.tokenVersion,
    ).toBe(1);
    const revoked = await request(app)
      .get('/cart')
      .set('Authorization', auth)
      .expect(401);
    expect(revoked.body.code).toBe('INVALID_AUTH_TOKEN');
  });
});
