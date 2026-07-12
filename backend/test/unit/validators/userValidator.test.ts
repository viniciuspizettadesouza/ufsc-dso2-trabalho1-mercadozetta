import { describe, expect, it } from 'vitest';
import { validateCreateUserPayload } from '@/validators/userValidator';

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
});
