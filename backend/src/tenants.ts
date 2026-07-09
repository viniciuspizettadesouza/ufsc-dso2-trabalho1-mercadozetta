export const defaultTenantId = 'mercadozetta';

export type Tenant = {
  id: string;
  name: string;
  active: boolean;
};

export const tenants: Record<string, Tenant> = {
  [defaultTenantId]: {
    id: defaultTenantId,
    name: 'MercadoZetta',
    active: true,
  },
  'campus-market': {
    id: 'campus-market',
    name: 'CampusMarket',
    active: true,
  },
};

export function resolveTenant(tenantId?: string | string[]) {
  const id = Array.isArray(tenantId) ? tenantId[0] : tenantId;
  const effectiveId = id || defaultTenantId;
  const tenant = tenants[effectiveId];

  if (!tenant || !tenant.active)
    return null;

  return tenant;
}
