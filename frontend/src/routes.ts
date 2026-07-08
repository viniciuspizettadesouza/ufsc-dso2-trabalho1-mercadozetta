export const appRoutes = {
    home: '/',
    login: '/login',
    register: '/register',
    newProduct: '/products/new',
    sellerProducts: (sellerId: string) => `/sellers/${sellerId}`,
};

export const routePatterns = {
    home: '/',
    login: '/login',
    register: '/register',
    newProduct: '/products/new',
    sellerProducts: '/sellers/:sellerId',
};

export const apiRoutes = {
    login: '/auth/login',
    users: '/users',
    products: '/products',
    sellerProducts: (sellerId: string) => `/users/${sellerId}/products`,
};
