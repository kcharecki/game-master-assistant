import { test, expect } from '@playwright/test';

test('GM desktop loads with seeded windows', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.desktop')).toBeVisible();
  await expect(page.locator('[data-win]').first()).toBeVisible();
  // At least the seeded set.
  expect(await page.locator('[data-win]').count()).toBeGreaterThanOrEqual(3);
});

test('broadcast page shows idle state', async ({ page }) => {
  await page.goto('/broadcast.html');
  await expect(page.locator('.broadcast')).toBeVisible();
  await expect(page.getByText('Awaiting the Keeper')).toBeVisible();
});

test('GM reveal reaches the broadcast window', async ({ context }) => {
  const gm = await context.newPage();
  await gm.goto('/');
  const view = await context.newPage();
  await view.goto('/broadcast.html');

  // Dock "Reveal" opens the reveal editor; the GM then pushes it on air.
  await gm.getByRole('button', { name: 'Reveal' }).click();
  await gm.getByRole('button', { name: 'Send to Broadcast' }).click();
  await expect(view.getByText('A Strange Symbol')).toBeVisible({ timeout: 5000 });
});

test('GM battle map reaches the broadcast window', async ({ context }) => {
  const gm = await context.newPage();
  await gm.goto('/');
  const view = await context.newPage();
  await view.goto('/broadcast.html');

  // Spawn the Battle Map window via the ＋ Widget menu, then put it on air.
  await gm.getByRole('button', { name: '＋ Widget' }).click();
  await gm.getByRole('menuitem', { name: 'Battle Map' }).click();
  await gm.getByRole('button', { name: 'On Air' }).click();
  await expect(view.locator('.mapview svg')).toBeVisible({ timeout: 5000 });
});
