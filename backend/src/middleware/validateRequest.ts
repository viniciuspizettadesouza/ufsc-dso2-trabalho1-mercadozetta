import type { Request, Response, NextFunction } from 'express';

type Schema = {
  body?: (value: Record<string, unknown>) => unknown;
  params?: (value: Record<string, unknown>) => unknown;
  query?: (value: Record<string, unknown>) => unknown;
};

function validateRequest(schema: Schema = {}) {
  return function requestValidator(req: Request, res: Response, next: NextFunction) {
    try {
      req.validated = {
        ...(req.validated || {}),
      };

      if (schema.body)
        req.validated.body = schema.body(req.body) as Record<string, unknown>;

      if (schema.params)
        req.validated.params = schema.params(req.params) as Record<string, string>;

      if (schema.query)
        req.validated.query = schema.query(req.query as Record<string, unknown>) as Record<string, unknown>;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default validateRequest;
