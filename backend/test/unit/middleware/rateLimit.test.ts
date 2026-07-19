import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { authenticatedAccountRateLimitKey } from '@/middleware/rateLimit';

function request(tenantId: string, userId: string, ip: string) {
  return {
    tenant: { id: tenantId },
    userId,
    ip,
  } as unknown as Request;
}

describe('account-management rate limiting', () => {
  it('scopes sensitive-operation attempts by tenant, user, and normalized client IP', () => {
    const baseline = authenticatedAccountRateLimitKey(
      request('mercadozetta', 'user-1', '192.0.2.10'),
    );

    expect(baseline).toBe('mercadozetta:user-1:192.0.2.10');
    expect(
      authenticatedAccountRateLimitKey(
        request('campus-market', 'user-1', '192.0.2.10'),
      ),
    ).not.toBe(baseline);
    expect(
      authenticatedAccountRateLimitKey(
        request('mercadozetta', 'user-2', '192.0.2.10'),
      ),
    ).not.toBe(baseline);
    expect(
      authenticatedAccountRateLimitKey(
        request('mercadozetta', 'user-1', '192.0.2.11'),
      ),
    ).not.toBe(baseline);
    expect(
      authenticatedAccountRateLimitKey(
        request('mercadozetta', 'user-1', '2001:db8:abcd:0012::1'),
      ),
    ).toBe(
      authenticatedAccountRateLimitKey(
        request('mercadozetta', 'user-1', '2001:db8:abcd:0012::2'),
      ),
    );
  });
});
