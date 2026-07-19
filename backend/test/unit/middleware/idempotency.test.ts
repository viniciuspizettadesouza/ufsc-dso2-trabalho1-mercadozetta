import { describe, expect, it, vi } from 'vitest';
import { requireIdempotencyKey } from '@/middleware/idempotency';

function request(value?: string) {
  return {
    get: vi.fn().mockReturnValue(value),
  };
}

describe('idempotency middleware', () => {
  it('normalizes and exposes a UUID idempotency key', () => {
    const req = request(' 507f191e-810c-4197-9de8-60ea00000001 ');
    const next = vi.fn();

    requireIdempotencyKey(req as never, {} as never, next);

    expect(req).toHaveProperty(
      'idempotencyKey',
      '507f191e-810c-4197-9de8-60ea00000001',
    );
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    [undefined, 'IDEMPOTENCY_KEY_REQUIRED'],
    ['not-a-uuid', 'INVALID_IDEMPOTENCY_KEY'],
  ])('rejects an unusable key', (value, code) => {
    const next = vi.fn();

    requireIdempotencyKey(request(value) as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code }),
    );
  });
});
