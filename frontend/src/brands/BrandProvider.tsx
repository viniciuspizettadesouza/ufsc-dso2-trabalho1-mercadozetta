import { ReactNode, useEffect, useMemo } from 'react';

import { getBrandByTenantId } from '.';
import { BrandContext } from '@/brands/brandContext';
import type { BrandConfig } from '@/brands/schema';

type BrandProviderProps = {
  brand?: BrandConfig;
  children: ReactNode;
};

function setCssVariable(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function applyTheme(theme: BrandConfig['theme']) {
  const { colors, typography, radius, shadows } = theme;

  setCssVariable('--theme-canvas', colors.canvas);
  setCssVariable('--theme-surface', colors.surface.default);
  setCssVariable('--theme-surface-emphasized', colors.surface.emphasized);
  setCssVariable('--theme-action-primary', colors.action.primary);
  setCssVariable('--theme-action-primary-text', colors.action.primaryText);
  setCssVariable('--theme-action-accent', colors.action.accent);
  setCssVariable('--theme-text', colors.text.primary);
  setCssVariable('--theme-text-muted', colors.text.muted);
  setCssVariable('--theme-border', colors.border);
  setCssVariable('--theme-font-body', typography.body);
  setCssVariable('--theme-font-heading', typography.heading);
  setCssVariable('--theme-radius-control', radius.control);
  setCssVariable('--theme-radius-surface', radius.surface);
  setCssVariable('--theme-shadow-surface', shadows.surface);
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
    applyTheme(activeBrand.theme);
  }, [activeBrand]);

  return (
    <BrandContext.Provider value={activeBrand}>
      {children}
    </BrandContext.Provider>
  );
}
