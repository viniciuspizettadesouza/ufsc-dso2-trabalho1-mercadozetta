const Product = require('@/model/product');
const Session = require('@/model/session');
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

  it('indexes session ownership and unique tenant-scoped families', () => {
    expect(Session.schema.indexes()).toContainEqual([
      { tenantId: 1, userId: 1, createdAt: -1 },
      expect.any(Object),
    ]);
    expect(Session.schema.indexes()).toContainEqual([
      { tenantId: 1, familyId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('cleans up expired sessions through a TTL index', () => {
    expect(Session.schema.indexes()).toContainEqual([
      { expiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 }),
    ]);
  });

  it('does not select stored refresh-token hashes by default', () => {
    expect(Session.schema.path('refreshTokenHash').options.select).toBe(false);
    expect(Session.schema.path('refreshTokenSecretVersion')).toBeDefined();
    expect(Session.schema.path('previousRefreshTokenHash').options.select).toBe(
      false,
    );
    expect(
      Session.schema.path('previousRefreshTokenSecretVersion'),
    ).toBeDefined();
  });
});
