import { expect, test } from '@playwright/test';
import { expectPageToBeAccessible, expectVisibleFocus } from './accessibility';

const campusMarket = process.env.E2E_TENANT_ID === 'campus-market';
const brandName = campusMarket ? 'CampusMarket' : 'MercadoZetta';
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
        name: 'mz_at',
        httpOnly: true,
        path: '/',
        sameSite: 'Lax',
      }),
      expect.objectContaining({
        name: 'mz_rt',
        httpOnly: true,
        path: '/auth',
        sameSite: 'Lax',
      }),
      expect.objectContaining({
        name: 'mz_csrf',
        httpOnly: false,
        path: '/',
        sameSite: 'Lax',
      }),
    ]),
  );

  await context.clearCookies({ name: 'mz_at' });
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url() === 'http://localhost:4333/auth/refresh' &&
      response.request().method() === 'POST',
  );
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  expect((await refreshResponse).status()).toBe(204);
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'mz_at'),
  ).toBe(true);

  const logoutResponse = page.waitForResponse(
    (response) =>
      response.url() === 'http://localhost:4333/auth/logout' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sair' }).click();

  expect((await logoutResponse).status()).toBe(204);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(
    (await context.cookies()).filter((cookie) =>
      ['mz_at', 'mz_rt', 'mz_csrf'].includes(cookie.name),
    ),
  ).toEqual([]);
});
