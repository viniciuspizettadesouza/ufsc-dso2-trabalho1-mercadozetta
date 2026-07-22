import { expect, test } from '@playwright/test';
import { expectPageToBeAccessible } from './accessibility';

const campusMarket = process.env.E2E_TENANT_ID === 'campus-market';
const tenantId = campusMarket ? 'campus-market' : 'mercadozetta';
const apiUrl = process.env.E2E_API_URL || 'http://localhost:4333';

const buyer = {
  email: `e2e.buyer@${tenantId}.test`,
  name: 'E2E Buyer',
  password: 'e2e-buyer-password',
  phone: '(48) 99999-0301',
};

const seller = campusMarket
  ? { email: 'vinicius@campus-market.test', password: 'campusmarket123' }
  : { email: 'vinicius@mercadozetta.test', password: 'mercadozetta123' };

const product = campusMarket
  ? {
      id: '67000000-0000-4000-8000-000000000003',
      initialInventory: 8,
      name: 'Calculadora Cientifica',
      quotePattern: /Current cart quote: 37,98\s€/,
      linePattern: /calculadora cientifica × 2 — 37,98\s€/i,
    }
  : {
      id: '67000000-0000-4000-8000-000000000001',
      initialInventory: 3,
      name: 'Notebook Dell Latitude',
      quotePattern: /Current cart quote: \$1,798\.00/,
      linePattern: /notebook dell latitude × 2 — \$1,798\.00/i,
    };

async function login(
  page: import('@playwright/test').Page,
  credentials: { email: string; password: string },
) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(credentials.email);
  await page.getByPlaceholder('Password').fill(credentials.password);
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/auth/login` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Entrar' }).click();
  expect((await loginResponsePromise).status()).toBe(200);
  await expect(page).not.toHaveURL('/login');
}

test('registers a tenant buyer and completes checkout and fulfillment', async ({
  browser,
  page,
}) => {
  await page.goto('/register');
  await expect(page.getByPlaceholder('Name')).toBeVisible();
  await expectPageToBeAccessible(page);
  await page.getByPlaceholder('Name').fill(buyer.name);
  await page.getByPlaceholder('Phone').fill(buyer.phone);
  await page.getByPlaceholder('Email').fill(buyer.email);
  await page.getByPlaceholder('Password').fill(buyer.password);

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/users` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Criar conta' }).click();

  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  expect(registrationResponse.request().headers()['x-tenant-id']).toBe(
    tenantId,
  );
  await expect(registrationResponse.json()).resolves.toMatchObject({
    email: buyer.email,
    tenantId,
    username: buyer.name.toLowerCase(),
  });
  await expect(page).toHaveURL('/');

  await login(page, buyer);
  await expect(page.getByText(buyer.email)).toBeVisible();

  await page.goto(`/products/${product.id}`);
  await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
  await expect(
    page
      .getByRole('definition')
      .filter({ hasText: new RegExp(`^${product.initialInventory}$`) }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status')).toHaveText('Added to cart.');
  await page.getByRole('link', { name: 'View cart' }).click();

  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
  await expectPageToBeAccessible(page);
  await page.getByLabel(`Quantity for ${product.name}`).selectOption('2');
  await expect(page.getByRole('status')).toHaveText('Cart quantity updated.');
  await expect(page.getByText(product.quotePattern)).toBeVisible();

  await page.goto('/account/addresses');
  await expect(
    page.getByRole('heading', { name: 'Delivery addresses' }),
  ).toBeVisible();
  await expectPageToBeAccessible(page);
  await page.getByLabel('Address label').fill('Home');
  await page.getByLabel('Recipient name').fill(buyer.name);
  await page.getByLabel('Address line 1').fill('10 Market Street');
  await page.getByLabel('City').fill('Lisbon');
  await page.getByLabel('Postal code').fill('1000-001');
  await page.getByLabel('Telephone').fill(buyer.phone);
  const addressResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/account/addresses` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add address' }).click();
  expect((await addressResponsePromise).status()).toBe(201);
  await expect(page.getByRole('status')).toHaveText('Delivery address added.');
  await page.getByRole('link', { name: 'Return to checkout' }).click();

  await expect(
    page.getByRole('heading', { name: 'Checkout review' }),
  ).toBeVisible();
  await expect(page.getByLabel(/Home \(default\)/)).toBeChecked();
  await expect(page.getByLabel(/Standard demo delivery/)).toBeChecked();
  await expect(
    page.getByRole('heading', { name: 'Authoritative order total' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place order' })).toBeEnabled();
  await expectPageToBeAccessible(page);

  const orderResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${apiUrl}/orders` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Place order' }).click();
  const orderResponse = await orderResponsePromise;
  expect(orderResponse.status()).toBe(201);
  const order = (await orderResponse.json()) as { _id: string };

  await expect(page.getByRole('status')).toHaveText(
    'Order placed successfully.',
  );
  await expect(page.getByText('Cart is empty.')).toBeVisible();
  await page.getByRole('link', { name: 'View order history' }).click();
  await expect(
    page.getByRole('heading', { name: 'Order history' }),
  ).toBeVisible();
  await expect(
    page.getByText(new RegExp(`${order._id} \\(placed\\)`)),
  ).toBeVisible();
  await expect(page.getByText(/Delivery snapshot:/)).toHaveText(
    /E2E Buyer, 10 Market Street, Lisbon, 1000-001, PT.*3–5 business days/,
  );

  await page.goto(`/products/${product.id}`);
  await expect(
    page
      .getByRole('definition')
      .filter({ hasText: new RegExp(`^${product.initialInventory - 2}$`) }),
  ).toBeVisible();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  try {
    await login(sellerPage, seller);
    await sellerPage.goto('/seller/orders');
    await expect(
      sellerPage.getByRole('heading', { name: `Order ${order._id}` }),
    ).toBeVisible();
    await expectPageToBeAccessible(sellerPage);
    await expect(sellerPage.getByText(product.linePattern)).toBeVisible();

    for (const status of ['confirmed', 'shipped', 'delivered']) {
      const statusResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url() === `${apiUrl}/orders/${order._id}/status` &&
          response.request().method() === 'PATCH',
      );
      await sellerPage
        .getByRole('button', { name: `Mark as ${status}` })
        .click();
      expect((await statusResponsePromise).status()).toBe(200);
      await expect(sellerPage.getByText(`Status: ${status}`)).toBeVisible();
    }
  } finally {
    await sellerContext.close();
  }

  await page.goto('/notifications');
  await expect(page.getByLabel('4 unread notifications')).toBeVisible();
  await expectPageToBeAccessible(page);
  const deliveredNotification = page
    .getByRole('listitem')
    .filter({ hasText: `Order ${order._id} is now delivered` });
  await expect(deliveredNotification).toBeVisible();
  await deliveredNotification
    .getByRole('button', { name: 'Mark as read' })
    .click();
  await expect(
    deliveredNotification.getByRole('button', { name: 'Mark as unread' }),
  ).toBeVisible();
});
