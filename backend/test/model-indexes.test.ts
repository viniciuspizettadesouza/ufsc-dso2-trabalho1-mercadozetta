const Product = require('@/model/product');
const User = require('@/model/user');

describe('model indexes', () => {
  it('keeps user emails unique per tenant', () => {
    expect(User.schema.indexes()).toContainEqual([
      { tenantId: 1, email: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('indexes products by tenant and seller', () => {
    expect(Product.schema.indexes()).toContainEqual([
      { tenantId: 1, seller: 1 },
      expect.any(Object),
    ]);
  });

  it('indexes product search per tenant', () => {
    expect(Product.schema.indexes()).toContainEqual([
      { tenantId: 1, name: 'text', description: 'text' },
      expect.any(Object),
    ]);
  });
});
