import { ReactNode, useEffect, useMemo } from 'react';

import { getBrandByTenantId } from '.';
import { BrandContext } from './brandContext';
import type { BrandConfig } from './schema';

type BrandProviderProps = {
  brand?: BrandConfig;
  children: ReactNode;
};

function setCssVariable(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function updateFavicon(href: string) {
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }

  icon.href = href;
}

export function BrandProvider({ brand, children }: BrandProviderProps) {
  const activeBrand = useMemo(
    () => brand || getBrandByTenantId(import.meta.env.VITE_TENANT_ID),
    [brand],
  );

  useEffect(() => {
    document.title = activeBrand.marketplaceName;
    updateFavicon(activeBrand.favicon);

    setCssVariable('--brand-primary', activeBrand.primaryColor);
    setCssVariable('--brand-secondary', activeBrand.secondaryColor);
    setCssVariable('--brand-accent', activeBrand.accentColor);
    setCssVariable('--brand-surface', activeBrand.surfaceColor);
    setCssVariable('--brand-text', activeBrand.textColor);
  }, [activeBrand]);

  return (
    <BrandContext.Provider value={activeBrand}>
      {children}
    </BrandContext.Provider>
  );
}
