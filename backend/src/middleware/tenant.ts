import type { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import { isTenantHeaderRequired } from '../config/security';
import { resolveTenant } from '../tenants';

function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantHeader = req.headers['x-tenant-id'] as string | undefined;

  if (!tenantHeader && isTenantHeaderRequired())
    return next(new AppError(400, 'TENANT_HEADER_REQUIRED', 'X-Tenant-Id header is required'));

  const tenant = resolveTenant(tenantHeader);

  if (!tenant)
    return next(new AppError(400, 'INVALID_TENANT', 'Invalid tenant'));

  req.tenant = tenant;
  return next();
}

export default tenantMiddleware;
