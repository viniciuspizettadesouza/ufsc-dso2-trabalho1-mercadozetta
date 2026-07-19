import { defaultBrand } from '@/brands/default';
import logo from '@/assets/campusmarket-logo.png';
import type { BrandConfig } from '@/brands/schema';

export const campusMarketBrand: BrandConfig = {
  ...defaultBrand,
  tenantId: 'campus-market',
  brandName: 'CampusMarket',
  marketplaceName: 'CampusMarket',
  logo,
  favicon: logo,
  theme: {
    colors: {
      canvas: '#f1f5f9',
      surface: {
        default: '#f8fafc',
        emphasized: '#dff7f0',
      },
      action: {
        primary: '#0f766e',
        primaryText: '#ffffff',
        accent: '#b45309',
      },
      text: {
        primary: '#172554',
        muted: '#475569',
      },
      border: '#cbd5e1',
    },
    typography: {
      body: 'Arial, Helvetica, sans-serif',
      heading: 'Arial, Helvetica, sans-serif',
    },
    radius: {
      control: '0.375rem',
      surface: '0.5rem',
    },
    shadows: {
      surface: '0 1px 3px rgb(15 23 42 / 12%)',
    },
  },
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
      subtitle:
        'Encontre materiais, serviços e oportunidades publicados pela comunidade universitária.',
      sellerActionLabel: 'Painel de ofertas',
      createProductAction: 'Publicar oferta',
    },
    forms: {
      ...defaultBrand.copy.forms,
      createProductAction: 'Publicar oferta',
    },
    account: {
      ...defaultBrand.copy.account,
      navigationAction: 'Conta CampusMarket',
      title: 'Configurações da conta CampusMarket',
    },
  },
};
