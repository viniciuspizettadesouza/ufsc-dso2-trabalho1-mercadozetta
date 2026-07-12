import request from 'supertest';
import app from '../../src/app';
import Cart from '../../src/model/cart';
import Notification from '../../src/model/notification';
import Order from '../../src/model/order';
import OrderItem from '../../src/model/orderItem';
import Product from '../../src/model/product';
import User from '../../src/model/user';
import {
  authorization,
  clearDatabase,
  connectDatabase,
  disconnectDatabase,
} from './helpers/database';

const tenantId = 'mercadozetta';

describe('checkout with a MongoDB replica set', () => {
  beforeAll(connectDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectDatabase);

  it('atomically sells the final unit and rolls back the losing checkout', async () => {
    const [seller, firstBuyer, secondBuyer] = await User.create([
      { tenantId, email: 'seller@example.com', password: 'password123' },
      { tenantId, email: 'first@example.com', password: 'password123' },
      { tenantId, email: 'second@example.com', password: 'password123' },
    ]);
    const product = await Product.create({
      tenantId,
      name: 'final unit',
      inventory: 1,
      image: 'https://example.com/final-unit.png',
      seller: seller._id,
    });
    await Cart.create([
      {
        tenantId,
        buyer: firstBuyer._id,
        items: [{ product: product._id, quantity: 1 }],
      },
      {
        tenantId,
        buyer: secondBuyer._id,
        items: [{ product: product._id, quantity: 1 }],
      },
    ]);

    const responses = await Promise.all(
      [firstBuyer, secondBuyer].map((buyer) =>
        request(app)
          .post('/orders')
          .set('X-Tenant-Id', tenantId)
          .set('Authorization', authorization(buyer._id)),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const conflict = responses.find(({ status }) => status === 409);
    expect(conflict?.body).toMatchObject({
      code: 'INSUFFICIENT_INVENTORY',
      error: 'A cart item is unavailable',
    });

    const successfulBuyer =
      responses[0].status === 201 ? firstBuyer : secondBuyer;
    const losingBuyer = responses[0].status === 409 ? firstBuyer : secondBuyer;
    const [storedProduct, orders, orderItems, notifications, carts] =
      await Promise.all([
        Product.findById(product._id).lean(),
        Order.find({ tenantId }).lean(),
        OrderItem.find({ tenantId }).lean(),
        Notification.find({ tenantId }).lean(),
        Cart.find({ tenantId }).lean(),
      ]);

    expect(storedProduct?.inventory).toBe(0);
    expect(orders).toHaveLength(1);
    expect(String(orders[0].buyer)).toBe(String(successfulBuyer._id));
    expect(orderItems).toHaveLength(1);
    expect(notifications).toHaveLength(2);
    expect(notifications.map(({ user }) => String(user)).sort()).toEqual(
      [String(seller._id), String(successfulBuyer._id)].sort(),
    );

    const successfulCart = carts.find(
      ({ buyer }) => String(buyer) === String(successfulBuyer._id),
    );
    const losingCart = carts.find(
      ({ buyer }) => String(buyer) === String(losingBuyer._id),
    );
    expect(successfulCart?.items).toHaveLength(0);
    expect(losingCart?.items).toHaveLength(1);
    expect(losingCart?.items[0].quantity).toBe(1);
  });
});
