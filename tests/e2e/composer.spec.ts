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

  const onAir = win.getByRole('button', { name: 'On Air', exact: true });
  await expect(onAir).toBeEnabled();
  await onAir.click();

  await expect(view.locator('.grid')).toBeVisible({ timeout: 5000 });
});
