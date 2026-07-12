import { campusMarketBrand } from './campusMarket';
import { defaultBrand } from './default';
import type { BrandConfig } from './schema';

const brands = {
  [defaultBrand.tenantId]: defaultBrand,
  [campusMarketBrand.tenantId]: campusMarketBrand,
};

export function getBrandByTenantId(tenantId?: string): BrandConfig {
  if (!tenantId) return defaultBrand;

  return brands[tenantId as keyof typeof brands] || defaultBrand;
}

export { campusMarketBrand, defaultBrand };
export type { BrandConfig };
