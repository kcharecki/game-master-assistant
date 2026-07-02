import { test, expect } from '@playwright/test';

test('editor surface: opening NPCs renders the roster authoring view', async ({ page }) => {
  await page.goto('/');
  // Left rail links open editor tabs (surface 2). The roster editor has its own heading.
  await page.getByRole('link', { name: 'NPCs' }).click();
  await expect(page.getByRole('heading', { name: 'NPC Roster' })).toBeVisible();
});

test('window system: resize a spawned widget changes its width', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.desktop')).toBeVisible();

  // Spawn a fresh Battle Map window from the dock.
  await page.getByRole('button', { name: 'Battle Map', exact: true }).click();

  const win = page.locator('[data-win]').filter({ hasText: 'Battle Map' }).last();
  await expect(win).toBeVisible();
  const before = (await win.boundingBox())!;

  // Drag the bottom-right resize grip outward.
  const grip = win.locator('.grip');
  const gb = (await grip.boundingBox())!;
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + 140, gb.y + 90, { steps: 8 });
  await page.mouse.up();

  const after = (await win.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 50);
});

test('dock: clicking a widget tile toggles its window hidden then visible', async ({ page }) => {
  await page.goto('/');
  const tile = page.getByRole('button', { name: 'Battle Map', exact: true });

  // First click spawns the window.
  await tile.click();
  const win = page.locator('[data-win]').filter({ hasText: 'Battle Map' });
  await expect(win).toBeVisible();

  // Clicking the tile again hides it (no minimize chip — it just disappears).
  await tile.click();
  await expect(win).toHaveCount(0);

  // A third click brings it back.
  await tile.click();
  await expect(page.locator('[data-win]').filter({ hasText: 'Battle Map' })).toBeVisible();
});
