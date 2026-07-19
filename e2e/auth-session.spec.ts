import { expect, test } from '@playwright/test';
import { expectPageToBeAccessible, expectVisibleFocus } from './accessibility';

const campusMarket = process.env.E2E_TENANT_ID === 'campus-market';
const brandName = campusMarket ? 'CampusMarket' : 'MercadoZetta';
const apiUrl = process.env.E2E_API_URL || 'http://localhost:4333';
const apiPath = new URL(apiUrl).pathname.replace(/\/$/, '');
const refreshCookiePath = `${apiPath}/auth` || '/auth';
const productionCookies = process.env.E2E_PRODUCTION_COOKIES === 'true';
const cookieNames = productionCookies
  ? {
      access: '__Host-mz_at',
      refresh: '__Secure-mz_rt',
      csrf: '__Host-mz_csrf',
    }
  : { access: 'mz_at', refresh: 'mz_rt', csrf: 'mz_csrf' };
const seller = campusMarket
  ? { email: 'vinicius@campus-market.test', password: 'campusmarket123' }
  : { email: 'vinicius@mercadozetta.test', password: 'mercadozetta123' };

test('returns to a protected route, renews cookies, and logs out', async ({
  context,
  page,
}) => {
  await page.goto('/checkout');

  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('status')).toHaveText(
    'Entre para acessar o checkout.',
  );
  await expectPageToBeAccessible(page);

  await page.keyboard.press('Tab');
  await expectVisibleFocus(
    page.getByRole('link', { name: `${brandName} logo` }),
  );
  await page.keyboard.press('Tab');
  await expectVisibleFocus(page.getByLabel('Email'));

  await page.getByPlaceholder('Email').fill(seller.email);
  await page.getByPlaceholder('Password').fill(seller.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expectPageToBeAccessible(page);
  expect(
    await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      user: localStorage.getItem('user'),
    })),
  ).toEqual({ token: null, user: null });

  const cookies = await context.cookies();
  expect(cookies).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: cookieNames.access,
        httpOnly: true,
        path: '/',
        sameSite: 'Lax',
      }),
      expect.objectContaining({
        name: cookieNames.refresh,
        httpOnly: true,
        path: refreshCookiePath,
        sameSite: 'Lax',
      }),
      expect.objectContaining({
        name: cookieNames.csrf,
        httpOnly: false,
        path: '/',
        sameSite: 'Lax',
      }),
    ]),
  );

  await context.clearCookies({ name: cookieNames.access });
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/auth/refresh` &&
      response.request().method() === 'POST',
  );
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  expect((await refreshResponse).status()).toBe(204);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === cookieNames.access,
    ),
  ).toBe(true);

  const logoutResponse = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/auth/logout` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sair' }).click();

  expect((await logoutResponse).status()).toBe(204);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(
    (await context.cookies()).filter((cookie) =>
      Object.values(cookieNames).includes(cookie.name),
    ),
  ).toEqual([]);
});
