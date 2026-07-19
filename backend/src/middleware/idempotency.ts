import type { RequestHandler } from 'express';
import { z } from 'zod';
import AppError from '@/errors/AppError';

export const idempotencyKeySchema = z.string().trim().uuid();

export const requireIdempotencyKey: RequestHandler = (req, _res, next) => {
  const value = req.get('Idempotency-Key');
  if (!value)
    return next(
      new AppError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header is required',
      ),
    );

  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success)
    return next(
      new AppError(
        400,
        'INVALID_IDEMPOTENCY_KEY',
        'Idempotency-Key must be a UUID',
      ),
    );

  req.idempotencyKey = parsed.data;
  return next();
};
