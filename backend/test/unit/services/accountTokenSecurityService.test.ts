import { describe, expect, it } from 'vitest';
import {
  accountTokenMatches,
  createAccountToken,
  getAccountTokenSelector,
} from '@/services/accountTokenSecurityService';

const ring = {
  activeVersion: 'current',
  keys: { current: 'current-secret', previous: 'previous-secret' },
};

describe('accountTokenSecurityService', () => {
  it('creates 256-bit opaque tokens and stores only a purpose-bound HMAC', () => {
    const generated = createAccountToken(
      'mercadozetta',
      'email_verification',
      ring,
    );

    expect(generated.token).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(getAccountTokenSelector(generated.token)).toBe(generated.selector);
    expect(generated.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.tokenHash).not.toContain(generated.token);
    expect(generated.tokenHashSecretVersion).toBe('current');
    expect(
      accountTokenMatches(
        generated.token,
        'mercadozetta',
        'email_verification',
        generated.tokenHash,
        'current',
        ring,
      ),
    ).toBe(true);
  });

  it('binds hashes to tenant, purpose, and retained secret version', () => {
    const previousRing = { ...ring, activeVersion: 'previous' };
    const generated = createAccountToken(
      'mercadozetta',
      'password_reset',
      previousRing,
    );

    expect(
      accountTokenMatches(
        generated.token,
        'mercadozetta',
        'password_reset',
        generated.tokenHash,
        'previous',
        ring,
      ),
    ).toBe(true);
    expect(
      accountTokenMatches(
        generated.token,
        'campus-market',
        'password_reset',
        generated.tokenHash,
        'previous',
        ring,
      ),
    ).toBe(false);
    expect(
      accountTokenMatches(
        generated.token,
        'mercadozetta',
        'email_verification',
        generated.tokenHash,
        'previous',
        ring,
      ),
    ).toBe(false);
    expect(
      accountTokenMatches(
        generated.token,
        'mercadozetta',
        'password_reset',
        generated.tokenHash,
        'removed',
        ring,
      ),
    ).toBe(false);
    expect(
      accountTokenMatches(
        generated.token,
        'mercadozetta',
        'password_reset',
        'malformed',
        'previous',
        ring,
      ),
    ).toBe(false);
  });

  it('rejects malformed selectors without exposing partial values', () => {
    expect(getAccountTokenSelector('')).toBeNull();
    expect(getAccountTokenSelector('not-a-uuid.secret')).toBeNull();
    expect(
      getAccountTokenSelector('507f1f77-bcf8-4ecd-8994-390110000001.short'),
    ).toBeNull();
    expect(
      getAccountTokenSelector(
        `507f1f77-bcf8-4ecd-8994-390110000001.${'a'.repeat(43)}.extra`,
      ),
    ).toBeNull();
  });
});
