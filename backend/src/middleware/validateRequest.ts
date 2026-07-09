import type { Request, Response, NextFunction } from 'express';

type Schema = {
  body?: (value: any) => unknown;
  params?: (value: any) => unknown;
  query?: (value: any) => unknown;
};

function validateRequest(schema: Schema = {}) {
  return function requestValidator(req: Request, res: Response, next: NextFunction) {
    try {
      req.validated = {
        ...(req.validated || {}),
      };

      if (schema.body)
        req.validated.body = schema.body(req.body);

      if (schema.params)
        req.validated.params = schema.params(req.params);

      if (schema.query)
        req.validated.query = schema.query(req.query);

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default validateRequest;
