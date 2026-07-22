import { describe, expect, it } from 'vitest';
import {
  authInvalidRequestExample,
  authStateResponseSchema,
  validateLoginPayload,
} from '@/validators/authValidator';

describe('authValidator', () => {
  it('normalizes login email and keeps the password unchanged', () => {
    expect(
      validateLoginPayload({
        email: ' Seller@Example.com ',
        password: ' secret123 ',
      }),
    ).toEqual({
      email: 'seller@example.com',
      password: ' secret123 ',
    });
  });

  it('rejects payloads missing email or password', () => {
    expect(() => validateLoginPayload()).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_CREDENTIALS',
      }),
    );

    expect(() => validateLoginPayload({ email: 'seller@example.com' })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_CREDENTIALS',
      }),
    );

    expect(() => validateLoginPayload({ password: 'secret123' })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_CREDENTIALS',
      }),
    );
  });

  it('keeps the malformed-payload error synchronized with the API example', () => {
    expect(() => validateLoginPayload('invalid' as never)).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: authInvalidRequestExample.code,
        message: authInvalidRequestExample.error,
      }),
    );
  });

  it('accepts the complete auth response including nullable user fields', () => {
    const timestamp = '2026-07-15T12:00:00.000Z';

    expect(
      authStateResponseSchema.parse({
        user: {
          _id: '507f1f77-bcf8-4ecd-8994-390110000001',
          tenantId: 'mercadozetta',
          email: 'seller@example.com',
          emailVerifiedAt: null,
          username: null,
          telephone: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        session: {
          id: '507f1f77-bcf8-4ecd-8994-390120000002',
          createdAt: timestamp,
          lastUsedAt: timestamp,
          expiresAt: '2026-07-22T12:00:00.000Z',
          absoluteExpiresAt: '2026-08-14T12:00:00.000Z',
        },
      }),
    ).toMatchObject({
      user: { username: null, telephone: null },
      session: { createdAt: timestamp },
    });
  });
});
