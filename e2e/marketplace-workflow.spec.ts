import { expect, test } from '@playwright/test';
import { expectPageToBeAccessible } from './accessibility';

const buyer = {
  email: 'e2e.buyer@mercadozetta.test',
  name: 'E2E Buyer',
  password: 'e2e-buyer-password',
  phone: '(48) 99999-0301',
};

const seller = {
  email: 'vinicius@mercadozetta.test',
  password: 'mercadozetta123',
};

const product = {
  id: '67000000-0000-4000-8000-000000000001',
  initialInventory: 3,
  name: 'Notebook Dell Latitude',
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
      response.url() === 'http://localhost:4333/auth/login' &&
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
      response.url() === 'http://localhost:4333/users' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Criar conta' }).click();

  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  expect(registrationResponse.request().headers()['x-tenant-id']).toBe(
    'mercadozetta',
  );
  await expect(registrationResponse.json()).resolves.toMatchObject({
    email: buyer.email,
    tenantId: 'mercadozetta',
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
  await page.getByRole('link', { name: 'Checkout' }).click();

  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expectPageToBeAccessible(page);
  await page.getByLabel(`Quantity for ${product.name}`).selectOption('2');
  await expect(page.getByRole('status')).toHaveText('Cart quantity updated.');
  await expect(page.getByText('Current cart quote: $1,798.00')).toBeVisible();

  const orderResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === 'http://localhost:4333/orders' &&
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
  await expect(
    page.getByText(new RegExp(`${order._id} \\(placed\\)`)),
  ).toBeVisible();

  await page.goto(`/products/${product.id}`);
  await expect(
    page.getByRole('definition').filter({ hasText: /^1$/ }),
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
    await expect(
      sellerPage.getByText(`${product.name} × 2 — $1,798.00`),
    ).toBeVisible();

    for (const status of ['confirmed', 'shipped', 'delivered']) {
      const statusResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url() ===
            `http://localhost:4333/orders/${order._id}/status` &&
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
