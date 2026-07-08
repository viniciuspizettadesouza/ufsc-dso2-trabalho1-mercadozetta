import logo from '../assets/mercadozetta-logo.png';
import type { BrandConfig } from './schema';

export const defaultBrand: BrandConfig = {
    tenantId: 'mercadozetta',
    brandName: 'MercadoZetta',
    marketplaceName: 'MercadoZetta',
    logo,
    favicon: logo,
    primaryColor: '#fff159',
    secondaryColor: '#3483fa',
    accentColor: '#00a650',
    surfaceColor: '#ffffff',
    textColor: '#333333',
    currency: 'BRL',
    locale: 'pt-BR',
    supportEmail: 'support@mercadozetta.example',
    legalName: 'MercadoZetta',
    copy: {
        header: {
            loginAction: 'Login',
            logoutAction: 'Logout',
            loggedUserFallback: 'Logged user',
        },
        catalog: {
            searchAction: 'Search products',
            searchPlaceholder: 'Search for a product',
            loading: 'Loading products...',
            loadError: 'Unable to load products.',
            empty: 'No products found :(',
            descriptionLabel: 'Product description:',
            inventoryLabel: 'Available:',
            soldOutLabel: 'Sold out',
            statusLabel: 'Status:',
            statusLabels: {
                draft: 'Draft',
                active: 'Active',
                paused: 'Paused',
                sold_out: 'Sold out',
                archived: 'Archived',
            },
        },
        home: {
            createAccountAction: 'Create account',
            createProductAction: 'Add products',
        },
        forms: {
            createAccountAction: 'Create account',
            loginAction: 'Login',
            createProductAction: 'Create listing',
            productStatusLabel: 'Product status',
        },
        validation: {
            loginRequiredForProduct: 'Sign in to create a listing.',
            accountCreateError: 'Unable to create the account. Try again.',
            productCreateError: 'Unable to create the listing. Try again.',
            invalidCredentials: 'Invalid email or password',
        },
    },
    features: {
        sellerPages: true,
        productCreation: true,
        publicCatalog: true,
        checkout: false,
        reviews: false,
        favorites: false,
        inventory: true,
    },
};
