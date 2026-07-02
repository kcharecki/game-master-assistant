import { test, expect } from '@playwright/test';

test('command palette is a focus-managed modal dialog', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  // Opening focuses the search field so keyboard users can type immediately.
  await expect(dialog.getByRole('textbox')).toBeFocused();
  // Escape returns focus to the page and closes the overlay.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('icon-only window controls expose accessible names', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.desktop')).toBeVisible();
  const win = page.locator('[data-win]').first();
  // The ✕ glyph control must be reachable by name, not just by sight.
  await expect(win.getByRole('button', { name: 'Close' })).toBeVisible();
});

test('spawned widget icon buttons have labels (initiative controls)', async ({ page }) => {
  await page.goto('/');
  // Initiative Tracker is seeded on first load; find its window directly.
  const win = page.locator('[data-win]').filter({ hasText: 'Initiative Tracker' }).first();
  await expect(win.getByRole('button', { name: 'Remove' }).first()).toBeVisible();
});
