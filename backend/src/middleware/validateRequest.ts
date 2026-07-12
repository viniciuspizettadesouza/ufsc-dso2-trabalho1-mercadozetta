import type { Request, Response, NextFunction, RequestHandler } from 'express';

type EmptyValidatedSection = Record<string, never>;

type RequestValidationSchema<
  TBodyInput extends object,
  TParamsInput extends object,
  TQueryInput extends object,
> = {
  body?: (value: TBodyInput) => object;
  params?: (value: TParamsInput) => object;
  query?: (value: TQueryInput) => object;
};

function validateRequest<
  TBodyInput extends object = EmptyValidatedSection,
  TParamsInput extends object = EmptyValidatedSection,
  TQueryInput extends object = EmptyValidatedSection,
>(
  schema: RequestValidationSchema<TBodyInput, TParamsInput, TQueryInput>,
): RequestHandler {
  return function requestValidator(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      req.validated = {
        ...(req.validated || {}),
      };

      if (schema.body) req.validated.body = schema.body(req.body as TBodyInput);

      if (schema.params)
        req.validated.params = schema.params(req.params as TParamsInput);

      if (schema.query)
        req.validated.query = schema.query(req.query as TQueryInput);

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default validateRequest;
