import { describe, expect, it } from 'vitest';
import {
  sellerProfileResponseSchema,
  userInvalidRequestExample,
  userResponseSchema,
  validateCreateUserPayload,
} from '@/validators/userValidator';

describe('userValidator', () => {
  it('normalizes a valid create-user payload', () => {
    expect(
      validateCreateUserPayload({
        email: ' Buyer@Example.com ',
        password: 'secret123',
        username: ' Buyer ',
        telephone: ' 999 ',
      }),
    ).toEqual({
      email: 'buyer@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '999',
    });
  });

  it('rejects missing required fields', () => {
    expect(() => validateCreateUserPayload()).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_USER_FIELDS',
      }),
    );

    expect(() =>
      validateCreateUserPayload({
        email: 'buyer@example.com',
        password: 'secret123',
        username: 'Buyer',
      }),
    ).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_USER_FIELDS',
      }),
    );

    expect(() =>
      validateCreateUserPayload({
        password: 'secret123',
        username: 'Buyer',
        telephone: '999',
      }),
    ).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'MISSING_USER_FIELDS',
      }),
    );
  });

  it('rejects invalid emails and weak passwords', () => {
    expect(() =>
      validateCreateUserPayload({
        email: 'invalid',
        password: 'secret123',
        username: 'Buyer',
        telephone: '999',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_EMAIL' }));

    expect(() =>
      validateCreateUserPayload({
        email: 'buyer@example.com',
        password: 'short',
        username: 'Buyer',
        telephone: '999',
      }),
    ).toThrow(expect.objectContaining({ code: 'WEAK_PASSWORD' }));
  });

  it('keeps the malformed-payload error synchronized with the API example', () => {
    expect(() => validateCreateUserPayload('invalid' as never)).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: userInvalidRequestExample.code,
        message: userInvalidRequestExample.error,
      }),
    );
  });

  it('accepts nullable persisted user and seller profile fields', () => {
    const userId = '507f1f77-bcf8-4ecd-8994-390110000001';
    const timestamp = '2026-07-15T12:00:00.000Z';

    expect(
      userResponseSchema.parse({
        _id: userId,
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        username: null,
        telephone: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).toMatchObject({ username: null, telephone: null });
    expect(
      sellerProfileResponseSchema.parse({
        _id: userId,
        email: 'seller@example.com',
        username: null,
        telephone: null,
        storeName: 'Seller store',
      }),
    ).toMatchObject({ username: null, telephone: null });
  });
});
