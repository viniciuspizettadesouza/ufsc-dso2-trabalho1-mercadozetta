import { describe, expect, it } from 'vitest';

import { apiRoutes, appRoutes, routePatterns } from '@/routes';

describe('routes', () => {
  it('builds stable app URLs', () => {
    expect(appRoutes.home).toBe('/');
    expect(appRoutes.login).toBe('/login');
    expect(appRoutes.register).toBe('/register');
    expect(appRoutes.newProduct).toBe('/products/new');
    expect(appRoutes.editProduct('product-1')).toBe('/products/product-1/edit');
    expect(appRoutes.productDetail('product-1')).toBe('/products/product-1');
    expect(appRoutes.checkout).toBe('/checkout');
    expect(appRoutes.notifications).toBe('/notifications');
    expect(appRoutes.sellerOrders).toBe('/seller/orders');
    expect(appRoutes.account).toBe('/account');
    expect(appRoutes.emailChangeConfirmation).toBe(
      '/account/email-change/confirm',
    );
    expect(appRoutes.sellerProducts('seller-1')).toBe('/sellers/seller-1');
    expect(appRoutes.sellerProfile('seller-1')).toBe(
      '/sellers/seller-1/profile',
    );
  });

  it('keeps route patterns aligned with React Router paths', () => {
    expect(routePatterns.home).toBe('/');
    expect(routePatterns.login).toBe('/login');
    expect(routePatterns.register).toBe('/register');
    expect(routePatterns.newProduct).toBe('/products/new');
    expect(routePatterns.editProduct).toBe('/products/:productId/edit');
    expect(routePatterns.productDetail).toBe('/products/:productId');
    expect(routePatterns.checkout).toBe('/checkout');
    expect(routePatterns.notifications).toBe('/notifications');
    expect(routePatterns.sellerOrders).toBe('/seller/orders');
    expect(routePatterns.account).toBe('/account');
    expect(routePatterns.emailChangeConfirmation).toBe(
      '/account/email-change/confirm',
    );
    expect(routePatterns.sellerProducts).toBe('/sellers/:sellerId');
    expect(routePatterns.sellerProfile).toBe('/sellers/:sellerId/profile');
  });

  it('builds API URLs that match the backend contract', () => {
    expect(apiRoutes.login).toBe('/auth/login');
    expect(apiRoutes.session).toBe('/auth/session');
    expect(apiRoutes.refresh).toBe('/auth/refresh');
    expect(apiRoutes.logout).toBe('/auth/logout');
    expect(apiRoutes.logoutCurrent).toBe('/auth/logout/current');
    expect(apiRoutes.sessions).toBe('/auth/sessions');
    expect(apiRoutes.revokeSession('session-1')).toBe(
      '/auth/sessions/session-1',
    );
    expect(apiRoutes.users).toBe('/users');
    expect(apiRoutes.products).toBe('/products');
    expect(apiRoutes.productDetail('product-1')).toBe('/products/product-1');
    expect(apiRoutes.productInventory('product-1')).toBe(
      '/products/product-1/inventory',
    );
    expect(apiRoutes.productStatus('product-1')).toBe(
      '/products/product-1/status',
    );
    expect(apiRoutes.sellerProfile('seller-1')).toBe('/users/seller-1');
    expect(apiRoutes.sellerProducts('seller-1')).toBe(
      '/users/seller-1/products',
    );
    expect(apiRoutes.accountProfile).toBe('/account/profile');
    expect(apiRoutes.passwordChanges).toBe('/account/password-changes');
    expect(apiRoutes.emailChanges).toBe('/account/email-changes');
    expect(apiRoutes.emailChangeConfirmations).toBe(
      '/auth/email-change/confirmations',
    );
    expect(apiRoutes.accountDeactivation).toBe('/account/deactivation');
  });
});
