export type BrandCopy = {
  header: {
    loginAction: string;
    logoutAction: string;
    loggedUserFallback: string;
  };
  catalog: {
    searchAction: string;
    searchPlaceholder: string;
    categoryFilterLabel: string;
    categoryFilterPlaceholder: string;
    availabilityFilterLabel: string;
    availabilityAnyLabel: string;
    availabilityInStockLabel: string;
    availabilitySoldOutLabel: string;
    sortLabel: string;
    sortNewestLabel: string;
    sortOldestLabel: string;
    sortNameLabel: string;
    sortInventoryLabel: string;
    loading: string;
    loadError: string;
    empty: string;
    descriptionLabel: string;
    priceUnavailableLabel: string;
    inventoryLabel: string;
    soldOutLabel: string;
    categoryLabel: string;
    subcategoryLabel: string;
    sellerLabel: string;
    statusLabel: string;
    detailsAction: string;
    watchAction: string;
    watchingAction: string;
    cartAction: string;
    inCartAction: string;
    statusLabels: {
      draft: string;
      active: string;
      paused: string;
      sold_out: string;
      archived: string;
    };
  };
  home: {
    headline: string;
    subtitle: string;
    sellerActionLabel: string;
    createAccountAction: string;
    createProductAction: string;
  };
  forms: {
    createAccountAction: string;
    loginAction: string;
    createProductAction: string;
    productStatusLabel: string;
    categoryLabel: string;
    subcategoryLabel: string;
    uploadImageLabel: string;
  };
  validation: {
    loginRequiredForProduct: string;
    accountCreateError: string;
    productCreateError: string;
    invalidCredentials: string;
  };
};

export type BrandFeatures = {
  sellerPages: boolean;
  productCreation: boolean;
  publicCatalog: boolean;
  checkout: boolean;
  reviews: boolean;
  favorites: boolean;
  inventory: boolean;
};

export type BrandConfig = {
  tenantId: string;
  brandName: string;
  marketplaceName: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  currency: string;
  locale: string;
  supportEmail: string;
  legalName: string;
  copy: BrandCopy;
  features: BrandFeatures;
};
