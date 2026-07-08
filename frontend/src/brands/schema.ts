export type BrandCopy = {
    header: {
        loginAction: string;
        logoutAction: string;
        loggedUserFallback: string;
    };
    catalog: {
        searchAction: string;
        searchPlaceholder: string;
        loading: string;
        loadError: string;
        empty: string;
        descriptionLabel: string;
    };
    home: {
        createAccountAction: string;
        createProductAction: string;
    };
    forms: {
        createAccountAction: string;
        loginAction: string;
        createProductAction: string;
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
