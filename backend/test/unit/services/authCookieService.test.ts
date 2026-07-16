import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAuthCookies, setAuthCookies } from '@/services/authCookieService';

afterEach(() => {
  vi.useRealTimers();
});

describe('auth cookie service', () => {
  it('sets HttpOnly credentials and a readable CSRF proof with bounded expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    const res = { cookie: vi.fn() };

    setAuthCookies(res as any, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
      session: { expiresAt: '2026-07-16T12:00:00.000Z' },
    });

    expect(res.cookie.mock.calls).toEqual([
      [
        'mz_at',
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 5 * 60 * 1000,
        }),
      ],
      [
        'mz_rt',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/auth',
          maxAge: 24 * 60 * 60 * 1000,
        }),
      ],
      [
        'mz_csrf',
        'csrf-token',
        expect.objectContaining({
          httpOnly: false,
          path: '/',
          maxAge: 24 * 60 * 60 * 1000,
        }),
      ],
    ]);
  });

  it('clears every cookie with its original scope and without Max-Age', () => {
    const res = { clearCookie: vi.fn() };

    clearAuthCookies(res as any);

    expect(res.clearCookie).toHaveBeenCalledTimes(3);
    expect(res.clearCookie).toHaveBeenCalledWith(
      'mz_at',
      expect.not.objectContaining({ maxAge: expect.anything() }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      'mz_rt',
      expect.objectContaining({ path: '/auth', httpOnly: true }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      'mz_csrf',
      expect.objectContaining({ path: '/', httpOnly: false }),
    );
  });

  it('never sets a negative cookie lifetime', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    const res = { cookie: vi.fn() };

    setAuthCookies(res as any, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
      session: { expiresAt: '2026-07-15T11:00:00.000Z' },
    });

    expect(res.cookie.mock.calls[1][2].maxAge).toBe(0);
    expect(res.cookie.mock.calls[2][2].maxAge).toBe(0);
  });
});
