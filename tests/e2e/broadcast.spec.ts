import { test, expect } from '@playwright/test';

test('broadcast rehydrates persisted on-air content after reload', async ({ context }) => {
  const gm = await context.newPage();
  await gm.goto('/');
  const view = await context.newPage();
  await view.goto('/broadcast.html');

  // Push the reveal on air; it mirrors to IndexedDB kv:broadcastState.
  await gm.getByRole('link', { name: 'Reveal' }).click();
  await gm.getByRole('button', { name: 'Send to Broadcast' }).click();
  await expect(view.getByText('A Strange Symbol')).toBeVisible({ timeout: 5000 });

  // Reload the broadcast page with no live GM push: it must rehydrate from kv.
  await view.reload();
  await expect(view.getByText('A Strange Symbol')).toBeVisible({ timeout: 5000 });
});

test('a second module (Handouts) can take over the broadcast', async ({ context }) => {
  const gm = await context.newPage();
  await gm.goto('/');
  const view = await context.newPage();
  await view.goto('/broadcast.html');

  // Handouts is seeded on first load; send its letter on air.
  const win = gm.locator('[data-win]').filter({ hasText: 'Handouts' }).first();
  await win.getByText('A Letter from the Order').click();
  await win.getByRole('button', { name: 'Send to Broadcast' }).click();

  await expect(view.getByText('A Letter from the Order')).toBeVisible({ timeout: 5000 });
});

test('Broadcast Preview embeds the broadcast page in preview mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Broadcast Preview', exact: true }).click();

  const win = page.locator('[data-win]').filter({ hasText: 'Broadcast Preview' }).last();
  const frame = win.locator('iframe[title="Broadcast preview"]');
  await expect(frame).toHaveAttribute('src', /broadcast\.html\?preview=1/);
});
