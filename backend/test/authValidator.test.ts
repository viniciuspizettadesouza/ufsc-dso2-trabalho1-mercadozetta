import { describe, expect, it } from 'vitest';

import AppError from '@/errors/AppError';
import { validateLoginPayload } from '@/validators/authValidator';

describe('auth validator', () => {
  it('normalizes login payloads and rejects missing credentials', () => {
    expect(
      validateLoginPayload({ email: ' USER@Example.com ', password: 'secret' }),
    ).toEqual({
      email: 'user@example.com',
      password: 'secret',
    });

    expect(() => validateLoginPayload({ email: 'user@example.com' })).toThrow(
      AppError,
    );
  });
});
