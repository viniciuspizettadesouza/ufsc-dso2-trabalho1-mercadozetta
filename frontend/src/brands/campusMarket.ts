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
            searchAction: 'Buscar ofertas',
            searchPlaceholder: 'Buscar ofertas do campus',
            loading: 'Carregando ofertas...',
            loadError: 'Não foi possível carregar as ofertas.',
            empty: 'Nenhuma oferta encontrada',
        },
        home: {
            ...defaultBrand.copy.home,
            headline: 'Ofertas úteis para a rotina do campus',
            subtitle: 'Encontre materiais, serviços e oportunidades publicados pela comunidade universitária.',
            sellerActionLabel: 'Painel de ofertas',
            createProductAction: 'Publicar oferta',
        },
        forms: {
            ...defaultBrand.copy.forms,
            createProductAction: 'Publicar oferta',
        },
    },
};
