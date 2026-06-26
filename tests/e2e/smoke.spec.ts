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

test('system switch toggles D&D / CoC', async ({ page }) => {
  await page.goto('/');
  const coc = page.getByRole('button', { name: 'CoC 7e' });
  const dnd = page.getByRole('button', { name: 'D&D 5e' });
  await dnd.click();
  await expect(dnd).toHaveAttribute('aria-pressed', 'true');
  await coc.click();
  await expect(coc).toHaveAttribute('aria-pressed', 'true');
});

test('command palette opens with Ctrl+K and finds results', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  // Typing surfaces a known seeded NPC.
  await dialog.getByRole('textbox').fill('Thorne');
  await expect(page.getByRole('option').first()).toContainText('Thorne');
  // Escape closes it.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
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
