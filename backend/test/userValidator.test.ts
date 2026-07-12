import { describe, expect, it } from 'vitest';

import AppError from '@/errors/AppError';
import { validateCreateUserPayload } from '@/validators/userValidator';

describe('user validator', () => {
  it('validates create-user payloads and enforces strong email/password rules', () => {
    expect(
      validateCreateUserPayload({
        email: ' Buyer@Example.com ',
        password: 'secret123',
        username: ' Buyer ',
        telephone: '123456789',
      }),
    ).toEqual({
      email: 'buyer@example.com',
      password: 'secret123',
      username: 'Buyer',
      telephone: '123456789',
    });

    expect(() =>
      validateCreateUserPayload({
        email: 'bad',
        password: '123',
        username: 'x',
        telephone: '1',
      }),
    ).toThrow(AppError);
  });
});
