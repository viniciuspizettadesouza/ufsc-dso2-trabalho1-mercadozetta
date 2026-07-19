import { describe, expect, it } from 'vitest';
import {
  validateAccountRequest,
  validateAccountTokenConfirmation,
  validatePasswordResetConfirmation,
} from '@/validators/accountSecurityValidator';

describe('accountSecurityValidator', () => {
  it('normalizes account request emails', () => {
    expect(validateAccountRequest({ email: ' Buyer@Example.com ' })).toEqual({
      email: 'buyer@example.com',
    });
  });

  it('rejects missing and invalid request emails', () => {
    expect(() => validateAccountRequest()).toThrow(
      expect.objectContaining({ code: 'MISSING_EMAIL' }),
    );
    expect(() => validateAccountRequest({ email: 'invalid' })).toThrow(
      expect.objectContaining({ code: 'INVALID_EMAIL' }),
    );
  });

  it('accepts opaque non-empty confirmation tokens', () => {
    expect(
      validateAccountTokenConfirmation({ token: ' opaque-token ' }),
    ).toEqual({ token: 'opaque-token' });
    expect(() => validateAccountTokenConfirmation()).toThrow(
      expect.objectContaining({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' }),
    );
  });

  it('validates password reset confirmation before token consumption', () => {
    expect(
      validatePasswordResetConfirmation({
        token: 'opaque-token',
        password: 'secret123',
        passwordConfirmation: 'secret123',
      }),
    ).toEqual({
      token: 'opaque-token',
      password: 'secret123',
      passwordConfirmation: 'secret123',
    });
    expect(() =>
      validatePasswordResetConfirmation({ token: 'opaque-token' }),
    ).toThrow(expect.objectContaining({ code: 'MISSING_PASSWORD_FIELDS' }));
    expect(() =>
      validatePasswordResetConfirmation({
        token: 'opaque-token',
        password: 'secret123',
        passwordConfirmation: 'different',
      }),
    ).toThrow(
      expect.objectContaining({ code: 'PASSWORD_CONFIRMATION_MISMATCH' }),
    );
    expect(() =>
      validatePasswordResetConfirmation({
        token: 'opaque-token',
        password: 'short',
        passwordConfirmation: 'short',
      }),
    ).toThrow(expect.objectContaining({ code: 'WEAK_PASSWORD' }));
  });
});
