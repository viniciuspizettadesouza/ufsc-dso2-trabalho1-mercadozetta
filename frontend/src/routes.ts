export const appRoutes = {
    home: '/',
    login: '/login',
    register: '/register',
    newProduct: '/products/new',
    checkout: '/checkout',
    admin: '/admin',
    productDetail: (productId: string) => `/products/${productId}`,
    sellerProducts: (sellerId: string) => `/sellers/${sellerId}`,
    sellerProfile: (sellerId: string) => `/sellers/${sellerId}/profile`,
};

export const routePatterns = {
    home: '/',
    login: '/login',
    register: '/register',
    newProduct: '/products/new',
    checkout: '/checkout',
    admin: '/admin',
    productDetail: '/products/:productId',
    sellerProducts: '/sellers/:sellerId',
    sellerProfile: '/sellers/:sellerId/profile',
};

export const apiRoutes = {
    login: '/auth/login',
    users: '/users',
    products: '/products',
    productDetail: (productId: string) => `/products/${productId}`,
    sellerProfile: (sellerId: string) => `/users/${sellerId}`,
    sellerProducts: (sellerId: string) => `/users/${sellerId}/products`,
};
