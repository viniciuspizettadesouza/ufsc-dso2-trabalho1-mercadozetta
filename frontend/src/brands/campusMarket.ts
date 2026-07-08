import { defaultBrand } from './default';
import logo from '../assets/campusmarket-logo.png';
import type { BrandConfig } from './schema';

export const campusMarketBrand: BrandConfig = {
    ...defaultBrand,
    tenantId: 'campus-market',
    brandName: 'CampusMarket',
    marketplaceName: 'CampusMarket',
    logo,
    favicon: logo,
    primaryColor: '#dff7f0',
    secondaryColor: '#0f766e',
    accentColor: '#f59e0b',
    surfaceColor: '#f8fafc',
    textColor: '#172554',
    currency: 'BRL',
    locale: 'pt-BR',
    supportEmail: 'support@campusmarket.example',
    legalName: 'CampusMarket',
    copy: {
        ...defaultBrand.copy,
        catalog: {
            ...defaultBrand.copy.catalog,
            searchAction: 'Search offers',
            searchPlaceholder: 'Search campus offers',
            loading: 'Loading offers...',
            loadError: 'Unable to load offers.',
            empty: 'No offers found :(',
        },
        home: {
            createAccountAction: 'Create account',
            createProductAction: 'Post offer',
        },
        forms: {
            ...defaultBrand.copy.forms,
            createProductAction: 'Post offer',
        },
    },
};
