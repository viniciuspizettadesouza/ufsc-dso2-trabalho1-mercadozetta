import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRequestOrigin,
  hasAllowedOrigin,
  requireAllowedOrigin,
  requireCsrf,
  validatePresentOrigin,
  valuesMatch,
} from '@/middleware/csrf';
import {
  createCsrfToken,
  createRefreshToken,
} from '@/services/sessionSecurityService';

const sessionId = '507f1f77-bcf8-4ecd-8994-390110000001';

function createRequest(
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {},
) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );

  return {
    headers: normalized,
    cookies,
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('CSRF and request-origin middleware', () => {
  it('accepts configured origins and an exact referer origin', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const next = vi.fn();

    requireAllowedOrigin(
      createRequest({ Origin: 'https://shop.example' }) as any,
      {} as any,
      next,
    );
    requireAllowedOrigin(
      createRequest({ Referer: 'https://shop.example/checkout' }) as any,
      {} as any,
      next,
    );

    expect(next.mock.calls).toEqual([[], []]);
  });

  it('rejects missing, malformed, and unlisted origins', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const next = vi.fn();

    for (const req of [
      createRequest(),
      createRequest({ Referer: 'not-a-url' }),
      createRequest({ Origin: 'https://attacker.example' }),
    ]) {
      requireAllowedOrigin(req as any, {} as any, next);
    }

    expect(next).toHaveBeenCalledTimes(3);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'INVALID_ORIGIN' }),
    );
  });

  it('allows origin-less login requests but validates presented origins', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const next = vi.fn();

    validatePresentOrigin(createRequest() as any, {} as any, next);
    validatePresentOrigin(
      createRequest({ Origin: 'https://attacker.example' }) as any,
      {} as any,
      next,
    );

    expect(next.mock.calls[0]).toEqual([]);
    expect(next.mock.calls[1][0]).toMatchObject({
      statusCode: 403,
      code: 'INVALID_ORIGIN',
    });
  });

  it('accepts a matching session-bound double-submit proof', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const csrfToken = createCsrfToken(sessionId);
    const refreshToken = createRefreshToken(sessionId);
    const req = createRequest(
      {
        Origin: 'https://shop.example',
        'X-CSRF-Token': csrfToken,
      },
      {
        mz_csrf: csrfToken,
        mz_rt: refreshToken,
      },
    );
    const next = vi.fn();

    requireCsrf(req as any, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects missing, mismatched, forged, wrong-session, and origin-less proofs', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const csrfToken = createCsrfToken(sessionId);
    const refreshToken = createRefreshToken(sessionId);
    const next = vi.fn();
    const validHeaders = {
      Origin: 'https://shop.example',
      'X-CSRF-Token': csrfToken,
    };

    for (const req of [
      createRequest(validHeaders, { mz_rt: refreshToken }),
      createRequest(validHeaders, {
        mz_csrf: createCsrfToken(sessionId),
        mz_rt: refreshToken,
      }),
      createRequest(
        { ...validHeaders, 'X-CSRF-Token': `${csrfToken.slice(0, -1)}x` },
        { mz_csrf: `${csrfToken.slice(0, -1)}x`, mz_rt: refreshToken },
      ),
      createRequest(validHeaders, {
        mz_csrf: csrfToken,
        mz_rt: createRefreshToken('507f1f77-bcf8-4ecd-8994-390120000002'),
      }),
      createRequest(
        { 'X-CSRF-Token': csrfToken },
        { mz_csrf: csrfToken, mz_rt: refreshToken },
      ),
    ]) {
      requireCsrf(req as any, {} as any, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'INVALID_CSRF_TOKEN' }),
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'INVALID_ORIGIN' }),
    );
  });

  it('covers the complete Origin and CSRF decision tree together', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');
    const next = vi.fn();
    const proof = createCsrfToken(sessionId);
    const refresh = createRefreshToken(sessionId);
    const origin = { Origin: 'https://shop.example' };

    requireAllowedOrigin(createRequest(origin) as any, {} as any, next);
    requireAllowedOrigin(
      createRequest({ Referer: 'https://shop.example/path' }) as any,
      {} as any,
      next,
    );
    requireAllowedOrigin(createRequest() as any, {} as any, next);
    requireAllowedOrigin(
      createRequest({ Referer: 'invalid' }) as any,
      {} as any,
      next,
    );
    validatePresentOrigin(createRequest() as any, {} as any, next);
    validatePresentOrigin(createRequest(origin) as any, {} as any, next);

    requireCsrf(
      {
        ...createRequest(
          { ...origin, 'X-CSRF-Token': proof },
          { mz_csrf: proof },
        ),
        sessionId,
      } as any,
      {} as any,
      next,
    );
    requireCsrf(
      createRequest(
        { ...origin, 'X-CSRF-Token': proof },
        { mz_csrf: proof, mz_rt: refresh },
      ) as any,
      {} as any,
      next,
    );

    for (const req of [
      createRequest({}, { mz_csrf: proof, mz_rt: refresh }),
      createRequest(origin, { mz_csrf: proof, mz_rt: refresh }),
      createRequest({ ...origin, 'X-CSRF-Token': proof }, { mz_csrf: proof }),
      createRequest(
        { ...origin, 'X-CSRF-Token': `${proof}x` },
        { mz_csrf: proof, mz_rt: refresh },
      ),
      createRequest(
        { ...origin, 'X-CSRF-Token': `${proof.slice(0, -1)}x` },
        { mz_csrf: `${proof.slice(0, -1)}x`, mz_rt: refresh },
      ),
    ]) {
      requireCsrf(req as any, {} as any, next);
    }

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_ORIGIN' }),
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_CSRF_TOKEN' }),
    );
  });

  it('evaluates origin parsing, allowlisting, and constant-time proof matching directly', () => {
    vi.stubEnv('CORS_ORIGIN', 'https://shop.example');

    expect(
      getRequestOrigin(
        createRequest({ Origin: 'https://shop.example' }) as any,
      ),
    ).toBe('https://shop.example');
    expect(
      getRequestOrigin(
        createRequest({ Referer: 'https://shop.example/path' }) as any,
      ),
    ).toBe('https://shop.example');
    expect(getRequestOrigin(createRequest() as any)).toBeNull();
    expect(
      getRequestOrigin(createRequest({ Referer: 'invalid' }) as any),
    ).toBeNull();
    expect(
      hasAllowedOrigin(
        createRequest({ Origin: 'https://shop.example' }) as any,
      ),
    ).toBe(true);
    expect(
      hasAllowedOrigin(
        createRequest({ Origin: 'https://attacker.example' }) as any,
      ),
    ).toBe(false);
    expect(valuesMatch('same', 'same')).toBe(true);
    expect(valuesMatch('same', 'diff')).toBe(false);
    expect(valuesMatch('short', 'much-longer')).toBe(false);
  });
});
