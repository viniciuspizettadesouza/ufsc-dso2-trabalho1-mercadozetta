import type { Response } from 'express';
import { getAuthCookieConfig } from '@/config/security';

type CookieCredentials = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  session: { expiresAt: Date | string };
};

function remainingLifetime(expiresAt: Date | string) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

export function setAuthCookies(res: Response, credentials: CookieCredentials) {
  const cookies = getAuthCookieConfig();
  const refreshMaxAge = remainingLifetime(credentials.session.expiresAt);

  res.cookie(
    cookies.access.name,
    credentials.accessToken,
    cookies.access.options,
  );
  res.cookie(cookies.refresh.name, credentials.refreshToken, {
    ...cookies.refresh.options,
    maxAge: refreshMaxAge,
  });
  res.cookie(cookies.csrf.name, credentials.csrfToken, {
    ...cookies.csrf.options,
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response) {
  const cookies = getAuthCookieConfig();

  for (const cookie of [cookies.access, cookies.refresh, cookies.csrf]) {
    const options = { ...cookie.options };
    delete options.maxAge;
    res.clearCookie(cookie.name, options);
  }
}
