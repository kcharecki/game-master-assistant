import { test, expect } from '@playwright/test';

test('editor surface: opening NPCs renders the roster authoring view', async ({ page }) => {
  await page.goto('/');
  // Left rail links open editor tabs (surface 2). The roster editor has its own heading.
  await page.getByRole('link', { name: 'NPCs' }).click();
  await expect(page.getByRole('heading', { name: 'NPC Roster' })).toBeVisible();
  // A tab for the open editor appears in the tab strip and can be closed.
  await expect(page.getByRole('button', { name: 'Close tab' })).toBeVisible();
});

test('window system: resize a spawned widget changes its width', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.desktop')).toBeVisible();

  // Spawn a fresh Battle Map window via the ＋ Widget menu.
  await page.getByRole('button', { name: '＋ Widget' }).click();
  await page.getByRole('menuitem', { name: 'Battle Map' }).click();

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

test('window system: minimize to dock then restore', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Widget' }).click();
  await page.getByRole('menuitem', { name: 'Battle Map' }).click();

  const win = page.locator('[data-win]').filter({ hasText: 'Battle Map' }).last();
  await expect(win).toBeVisible();

  // Minimize collapses the window to a dock chip.
  await win.getByRole('button', { name: 'Minimize' }).click();
  await expect(win).toBeHidden();
  const chip = page.locator('.minchip').filter({ hasText: 'Battle Map' });
  await expect(chip).toBeVisible();

  // Clicking the chip restores the window.
  await chip.click();
  await expect(page.locator('[data-win]').filter({ hasText: 'Battle Map' }).last()).toBeVisible();
});
