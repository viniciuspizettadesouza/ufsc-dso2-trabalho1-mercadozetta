export const defaultTenantId = 'mercadozetta';

export type Tenant = {
  id: string;
  name: string;
  active: boolean;
  currencyCode: string;
  currencyMinorUnit: number;
};

export const tenants: Record<string, Tenant> = {
  [defaultTenantId]: {
    id: defaultTenantId,
    name: 'MercadoZetta',
    active: true,
    currencyCode: 'USD',
    currencyMinorUnit: 2,
  },
  'campus-market': {
    id: 'campus-market',
    name: 'CampusMarket',
    active: true,
    currencyCode: 'EUR',
    currencyMinorUnit: 2,
  },
};

export function resolveTenant(tenantId?: string | string[]) {
  const id = Array.isArray(tenantId) ? tenantId[0] : tenantId;
  const effectiveId = id || defaultTenantId;
  const tenant = tenants[effectiveId];

  if (!tenant || !tenant.active) return null;

  return tenant;
}
