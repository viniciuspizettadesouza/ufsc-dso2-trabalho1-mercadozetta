import { campusMarketBrand } from '@/brands/campusMarket';
import { defaultBrand } from '@/brands/default';
import type { BrandConfig } from '@/brands/schema';

const brands = {
  [defaultBrand.tenantId]: defaultBrand,
  [campusMarketBrand.tenantId]: campusMarketBrand,
};

export function getBrandByTenantId(tenantId?: string): BrandConfig {
  if (!tenantId) return defaultBrand;

  return brands[tenantId as keyof typeof brands] || defaultBrand;
}

export { campusMarketBrand, defaultBrand };
export type { BrandConfig, BrandTheme } from '@/brands/schema';
