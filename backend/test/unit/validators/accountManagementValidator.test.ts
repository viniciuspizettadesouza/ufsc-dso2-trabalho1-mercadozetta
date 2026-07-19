import { describe, expect, it } from 'vitest';
import {
  validateAccountDeactivation,
  validateEmailChangeRequest,
  validatePasswordChange,
  validateProfileUpdate,
} from '@/validators/accountManagementValidator';

describe('accountManagementValidator', () => {
  it('accepts only normalized editable profile fields', () => {
    expect(
      validateProfileUpdate({
        username: '  Updated Seller  ',
        telephone: null,
      }),
    ).toEqual({ username: 'Updated Seller', telephone: null });
    expect(validateProfileUpdate({ telephone: '  +55 48 9999  ' })).toEqual({
      telephone: '+55 48 9999',
    });
  });

  it('rejects empty, invalid, and unknown profile fields', () => {
    expect(() => validateProfileUpdate()).toThrow(
      expect.objectContaining({ code: 'MISSING_PROFILE_UPDATE_FIELDS' }),
    );
    expect(() => validateProfileUpdate({ username: '   ' })).toThrow(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    );
    expect(() =>
      validateProfileUpdate({
        username: 'seller',
        email: 'other@example.com',
      } as never),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    expect(() => validateProfileUpdate({ telephone: 123 })).toThrow(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    );
  });

  it('validates a complete password change without normalizing secrets', () => {
    expect(
      validatePasswordChange({
        currentPassword: ' current secret ',
        password: ' replacement secret ',
        passwordConfirmation: ' replacement secret ',
      }),
    ).toEqual({
      currentPassword: ' current secret ',
      password: ' replacement secret ',
      passwordConfirmation: ' replacement secret ',
    });
  });

  it('rejects incomplete, mismatched, weak, and unknown password fields', () => {
    expect(() => validatePasswordChange()).toThrow(
      expect.objectContaining({ code: 'MISSING_PASSWORD_CHANGE_FIELDS' }),
    );
    expect(() =>
      validatePasswordChange({
        currentPassword: 'current123',
        password: 'replacement123',
        passwordConfirmation: 'different123',
      }),
    ).toThrow(
      expect.objectContaining({ code: 'PASSWORD_CONFIRMATION_MISMATCH' }),
    );
    expect(() =>
      validatePasswordChange({
        currentPassword: 'current123',
        password: 'short',
        passwordConfirmation: 'short',
      }),
    ).toThrow(expect.objectContaining({ code: 'WEAK_PASSWORD' }));
    expect(() =>
      validatePasswordChange({
        currentPassword: 'current123',
        password: 'replacement123',
        passwordConfirmation: 'replacement123',
        userId: 'other-user',
      } as never),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
  });

  it('normalizes an email-change address without changing the password', () => {
    expect(
      validateEmailChangeRequest({
        email: '  NEW.Address@Example.COM ',
        currentPassword: ' current secret ',
      }),
    ).toEqual({
      email: 'new.address@example.com',
      currentPassword: ' current secret ',
    });
  });

  it('rejects incomplete, invalid, and unknown email-change fields', () => {
    expect(() => validateEmailChangeRequest()).toThrow(
      expect.objectContaining({ code: 'MISSING_EMAIL_CHANGE_FIELDS' }),
    );
    expect(() =>
      validateEmailChangeRequest({
        email: 'not-an-email',
        currentPassword: 'secret123',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_EMAIL' }));
    expect(() =>
      validateEmailChangeRequest({
        email: 'new@example.com',
        currentPassword: 'secret123',
        userId: 'other-user',
      } as never),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
  });

  it('requires exact deactivation confirmation without changing password bytes', () => {
    expect(
      validateAccountDeactivation({
        currentPassword: ' current secret ',
        confirmation: 'DEACTIVATE',
      }),
    ).toEqual({
      currentPassword: ' current secret ',
      confirmation: 'DEACTIVATE',
    });
    expect(() =>
      validateAccountDeactivation({
        currentPassword: 'secret123',
        confirmation: 'deactivate',
      }),
    ).toThrow(
      expect.objectContaining({ code: 'DEACTIVATION_CONFIRMATION_MISMATCH' }),
    );
    expect(() =>
      validateAccountDeactivation({
        currentPassword: 'secret123',
        confirmation: 'DEACTIVATE',
        userId: 'other-user',
      } as never),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
  });
});
