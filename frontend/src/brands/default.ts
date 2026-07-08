import logo from '../assets/logo.svg';
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
    supportEmail: 'suporte@mercadozetta.example',
    legalName: 'MercadoZetta',
    copy: {
        header: {
            loginAction: 'Login',
            logoutAction: 'Logout',
            loggedUserFallback: 'Logged user',
        },
        catalog: {
            searchAction: 'Buscar Produtos',
            searchPlaceholder: 'Procure um produto',
            loading: 'Carregando produtos...',
            loadError: 'Não foi possível carregar os produtos.',
            empty: 'Nenhum produto encontrado :(',
            descriptionLabel: 'Descrição do produto:',
        },
        home: {
            createAccountAction: 'Criar conta',
            createProductAction: 'Inserir Produtos',
        },
        forms: {
            createAccountAction: 'Criar conta',
            loginAction: 'Login',
            createProductAction: 'Inserir Anúncio',
        },
        validation: {
            loginRequiredForProduct: 'Faça login para inserir um anúncio.',
            accountCreateError: 'Não foi possível criar a conta. Tente novamente.',
            productCreateError: 'Não foi possível inserir o anúncio. Tente novamente.',
            invalidCredentials: 'E-mail ou senha inválidos',
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
