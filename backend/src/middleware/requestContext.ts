import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', requestId);

  return next();
}

export default requestContext;
