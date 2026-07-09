import type { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import { resolveTenant } from '../tenants';

function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenant = resolveTenant(req.headers['x-tenant-id'] as string | undefined);

  if (!tenant)
    return next(new AppError(400, 'INVALID_TENANT', 'Invalid tenant'));

  req.tenant = tenant;
  return next();
}

export default tenantMiddleware;
