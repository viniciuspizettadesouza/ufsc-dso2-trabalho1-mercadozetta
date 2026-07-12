import { describe, expect, it } from 'vitest';

import { apiRoutes, appRoutes, routePatterns } from './routes';

describe('routes', () => {
  it('builds stable app URLs', () => {
    expect(appRoutes.home).toBe('/');
    expect(appRoutes.login).toBe('/login');
    expect(appRoutes.register).toBe('/register');
    expect(appRoutes.newProduct).toBe('/products/new');
    expect(appRoutes.productDetail('product-1')).toBe('/products/product-1');
    expect(appRoutes.checkout).toBe('/checkout');
    expect(appRoutes.admin).toBe('/admin');
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
    expect(routePatterns.productDetail).toBe('/products/:productId');
    expect(routePatterns.checkout).toBe('/checkout');
    expect(routePatterns.admin).toBe('/admin');
    expect(routePatterns.sellerProducts).toBe('/sellers/:sellerId');
    expect(routePatterns.sellerProfile).toBe('/sellers/:sellerId/profile');
  });

  it('builds API URLs that match the backend contract', () => {
    expect(apiRoutes.login).toBe('/auth/login');
    expect(apiRoutes.users).toBe('/users');
    expect(apiRoutes.products).toBe('/products');
    expect(apiRoutes.productDetail('product-1')).toBe('/products/product-1');
    expect(apiRoutes.sellerProfile('seller-1')).toBe('/users/seller-1');
    expect(apiRoutes.sellerProducts('seller-1')).toBe(
      '/users/seller-1/products',
    );
  });
});
