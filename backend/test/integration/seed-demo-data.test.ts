import { Types } from 'mongoose';
import Product from '../../src/model/product';
import User from '../../src/model/user';
import { seedDemoData } from '../../src/scripts/seedDemoData';
import {
  clearDatabase,
  connectDatabase,
  disconnectDatabase,
} from './helpers/database';

describe('demo data seeding', () => {
  beforeAll(connectDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectDatabase);

  it('is repeatable for both tenants and preserves unrelated records', async () => {
    const unrelatedUser = await User.create({
      _id: new Types.ObjectId(),
      tenantId: 'mercadozetta',
      email: 'unrelated@example.com',
      password: 'password123',
      username: 'Unrelated',
    });
    const unrelatedProduct = await Product.create({
      tenantId: 'mercadozetta',
      name: 'unrelated product',
      inventory: 9,
      image: 'https://example.com/unrelated.png',
      seller: unrelatedUser._id,
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await seedDemoData({ connect: false });
    await seedDemoData({ connect: false });

    expect(await User.countDocuments()).toBe(5);
    expect(await Product.countDocuments()).toBe(5);
    expect(await User.countDocuments({ tenantId: 'mercadozetta' })).toBe(3);
    expect(await User.countDocuments({ tenantId: 'campus-market' })).toBe(2);
    expect(await Product.countDocuments({ tenantId: 'mercadozetta' })).toBe(3);
    expect(await Product.countDocuments({ tenantId: 'campus-market' })).toBe(2);
    expect(await User.exists({ _id: unrelatedUser._id })).not.toBeNull();
    expect(await Product.exists({ _id: unrelatedProduct._id })).not.toBeNull();
    expect((await Product.findById(unrelatedProduct._id))?.inventory).toBe(9);

    log.mockRestore();
  });
});
