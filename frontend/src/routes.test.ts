import { describe, expect, it } from 'vitest';

import { apiRoutes, appRoutes, routePatterns } from './routes';

describe('routes', () => {
    it('builds stable app URLs', () => {
        expect(appRoutes.home).toBe('/');
        expect(appRoutes.login).toBe('/login');
        expect(appRoutes.register).toBe('/register');
        expect(appRoutes.newProduct).toBe('/products/new');
        expect(appRoutes.sellerProducts('seller-1')).toBe('/sellers/seller-1');
    });

    it('keeps route patterns aligned with React Router paths', () => {
        expect(routePatterns.home).toBe('/');
        expect(routePatterns.login).toBe('/login');
        expect(routePatterns.register).toBe('/register');
        expect(routePatterns.newProduct).toBe('/products/new');
        expect(routePatterns.sellerProducts).toBe('/sellers/:sellerId');
    });

    it('builds API URLs that match the backend contract', () => {
        expect(apiRoutes.login).toBe('/auth/login');
        expect(apiRoutes.users).toBe('/users');
        expect(apiRoutes.products).toBe('/products');
        expect(apiRoutes.sellerProducts('seller-1')).toBe('/users/seller-1/products');
    });
});
