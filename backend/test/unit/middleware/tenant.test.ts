import { afterEach, describe, expect, it, vi } from 'vitest';
import tenantMiddleware from '@/middleware/tenant';

describe('tenantMiddleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the default tenant when no tenant header is provided', () => {
    const req: any = { headers: {} };
    const next = vi.fn();

    tenantMiddleware(req, {} as any, next);

    expect(req.tenant).toEqual(
      expect.objectContaining({
        id: 'mercadozetta',
        name: 'MercadoZetta',
        currencyCode: 'USD',
        currencyMinorUnit: 2,
      }),
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('resolves valid tenant headers', () => {
    const req: any = { headers: { 'x-tenant-id': 'campus-market' } };
    const next = vi.fn();

    tenantMiddleware(req, {} as any, next);

    expect(req.tenant).toEqual(
      expect.objectContaining({
        id: 'campus-market',
        name: 'CampusMarket',
        currencyCode: 'USD',
        currencyMinorUnit: 2,
      }),
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('requires the tenant header when strict mode is enabled', () => {
    vi.stubEnv('TENANT_HEADER_REQUIRED', 'true');
    const next = vi.fn();

    tenantMiddleware({ headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'TENANT_HEADER_REQUIRED',
      }),
    );
  });

  it('rejects invalid tenant headers', () => {
    const req: any = { headers: { 'x-tenant-id': 'unknown' } };
    const next = vi.fn();

    tenantMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'INVALID_TENANT',
      }),
    );
  });
});
