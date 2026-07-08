import { defaultBrand } from './default';
import type { BrandConfig } from './schema';

export const campusMarketBrand: BrandConfig = {
    ...defaultBrand,
    tenantId: 'campus-market',
    brandName: 'CampusMarket',
    marketplaceName: 'CampusMarket',
    primaryColor: '#dff7f0',
    secondaryColor: '#0f766e',
    accentColor: '#f59e0b',
    surfaceColor: '#f8fafc',
    textColor: '#172554',
    currency: 'BRL',
    locale: 'pt-BR',
    supportEmail: 'suporte@campusmarket.example',
    legalName: 'CampusMarket',
    copy: {
        ...defaultBrand.copy,
        catalog: {
            ...defaultBrand.copy.catalog,
            searchAction: 'Buscar Ofertas',
            searchPlaceholder: 'Procure algo no campus',
            loading: 'Carregando ofertas...',
            loadError: 'Não foi possível carregar as ofertas.',
            empty: 'Nenhuma oferta encontrada :(',
        },
        home: {
            createAccountAction: 'Criar conta',
            createProductAction: 'Publicar oferta',
        },
        forms: {
            ...defaultBrand.copy.forms,
            createProductAction: 'Publicar Oferta',
        },
    },
};
