import { createHash } from 'node:crypto';
import AppError from '@/errors/AppError';

export function mutationRequestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function idempotencyKeyConflict() {
  return new AppError(
    409,
    'IDEMPOTENCY_KEY_REUSED',
    'Idempotency-Key was already used for a different request',
  );
}
