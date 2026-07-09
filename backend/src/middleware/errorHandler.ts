import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import AppError from '../errors/AppError';

function isJsonParseError(err: Error | object) {
  return (
    typeof err === 'object'
    && err !== null
    && 'type' in err
    && err.type === 'entity.parse.failed'
  );
}

const errorHandler: ErrorRequestHandler = (err, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent)
    return next(err);

  if (err instanceof AppError)
    return res.status(err.statusCode).send({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });

  if (isJsonParseError(err))
    return res.status(400).send({
      error: 'Invalid JSON payload',
      code: 'INVALID_JSON_PAYLOAD',
    });

  return res.status(500).send({
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
  });
};

export default errorHandler;
