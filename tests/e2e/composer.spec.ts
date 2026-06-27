import { test, expect } from '@playwright/test';

test('Broadcast Composer wires a source and pushes a grid on air', async ({ context }) => {
  const gm = await context.newPage();
  await gm.goto('/');
  const view = await context.newPage();
  await view.goto('/broadcast.html');

  // Spawn the composer window.
  await gm.getByRole('button', { name: '＋ Widget' }).click();
  await gm.getByRole('menuitem', { name: 'Broadcast Composer' }).click();

  const win = gm.locator('[data-win]').filter({ hasText: 'Broadcast Composer' }).last();

  // The seeded graph has an NPC node already wired into the grid's slot 0;
  // pick an NPC so it resolves into a cell, then go on air.
  await win.getByRole('combobox', { name: 'NPC' }).selectOption({ index: 1 });

  const broadcast = win.getByRole('button', { name: 'Broadcast', exact: true });
  await expect(broadcast).toBeEnabled();
  await broadcast.click();

  await expect(view.locator('.grid')).toBeVisible({ timeout: 5000 });
});

test('Broadcast Composer tabs: add and duplicate views', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Widget' }).click();
  await page.getByRole('menuitem', { name: 'Broadcast Composer' }).click();

  const win = page.locator('[data-win]').filter({ hasText: 'Broadcast Composer' }).last();
  const tabs = win.locator('.tabstrip .tab');

  await expect(tabs).toHaveCount(1);

  // ＋ adds a fresh view.
  await win.getByRole('button', { name: 'Add view' }).click();
  await expect(tabs).toHaveCount(2);

  // ⧉ duplicates the active view.
  await win.getByRole('button', { name: 'Duplicate view' }).click();
  await expect(tabs).toHaveCount(3);
});

test('Broadcast Composer can manually wire a new source into a grid slot', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Widget' }).click();
  await page.getByRole('menuitem', { name: 'Broadcast Composer' }).click();

  const win = page.locator('[data-win]').filter({ hasText: 'Broadcast Composer' }).last();

  // Seed graph already has one edge (npc -> slot 0). Add an Image source node…
  await win.getByRole('button', { name: '＋ Image' }).click();

  const wires = win.locator('svg.wires path.wire:not(.live)');
  const before = await wires.count();

  // …and drag a wire from its output port onto the grid's slot 1.
  const port = win.locator('.node', { hasText: 'Image' }).locator('.port.out');
  const slot = win.locator('.slotrow[aria-label="Slot 1"]');
  const a = await port.boundingBox();
  const b = await slot.boundingBox();
  if (!a || !b) throw new Error('port/slot not found');

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 20); // start the drag
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();

  // A new edge must exist — proving manual wiring works (regression: pointer
  // capture used to swallow the drop so no edge could ever be made).
  await expect(wires).toHaveCount(before + 1);
});
