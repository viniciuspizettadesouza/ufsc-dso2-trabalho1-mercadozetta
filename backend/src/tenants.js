const defaultTenantId = 'mercadozetta';

const tenants = {
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

function resolveTenant(tenantId) {
    const id = tenantId || defaultTenantId;
    const tenant = tenants[id];

    if (!tenant || !tenant.active)
        return null;

    return tenant;
}

module.exports = {
    defaultTenantId,
    resolveTenant,
    tenants,
};
