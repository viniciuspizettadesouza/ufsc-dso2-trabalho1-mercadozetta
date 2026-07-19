import { describe, expect, it } from 'vitest';
import { createIdempotencyKey } from '@/services/idempotency';

describe('idempotency service', () => {
  it('creates RFC 4122 version 4 keys', () => {
    expect(createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
