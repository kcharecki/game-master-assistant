import { test, expect } from '@playwright/test';
import { installCursor, caption, beat } from './showcase-util';

/**
 * SHOWCASE (not a pass/fail gate) — drives the real Session Notes editor to
 * record a narrated demo video of its components interacting:
 *   capture + live-preview  →  #tag / @npc autocomplete  →  timeline grows  →
 *   search  →  focus a note (context + tags card)  →  tag filter  →
 *   recap generator  →  push recap to the Broadcast (parchment).
 *
 * Run it on its own (it is slow, deliberately paced) and grab the video:
 *   npx playwright test showcase-notebook
 *   → video lands in  test-results/…-showcase-notebook-…/video.webm
 *
 * Record video + a fixed 1280×800 frame so the clip is presentation-sized.
 */
test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: 'on', size: { width: 1280, height: 800 } },
});

test('Session Notes — feature showcase', async ({ page, context }) => {
  await installCursor(page);
  await page.goto('/');
  await expect(page.locator('.desktop')).toBeVisible();

  // 1 — open the Session Notes editor tab from the left rail.
  await caption(page, 'Session Notes — open the authoring tab');
  await page.getByRole('link', { name: 'Session Notes' }).click();
  await expect(page.locator('.nbe')).toBeVisible();
  await beat(page);

  const ta = page.locator('.nbe .nb-ta');

  // 2 — capture with #tag autocomplete (existing tag "innsmouth").
  await caption(page, 'Capture a note — #tags autocomplete from your library');
  await ta.click();
  await ta.pressSequentially('Docks raid at dawn — the cult struck fast. ', { delay: 40 });
  await ta.pressSequentially('#inn', { delay: 120 });
  await expect(page.locator('.nb-ac')).toBeVisible();
  await expect(page.locator('.nb-acitem').first()).toContainText('innsmouth');
  await beat(page, 700);
  await page.keyboard.press('Enter'); // accept the tag suggestion
  await page.keyboard.press('Enter'); // no popup → save the note
  await expect(page.locator('.nbe-row')).toHaveCount(2); // seed + this one
  await beat(page);

  // 3 — capture with @npc autocomplete (roster-driven).
  await caption(page, '@npc mentions autocomplete straight from the roster');
  await ta.click();
  await ta.pressSequentially('@Captain', { delay: 90 });
  await expect(page.locator('.nb-ac')).toBeVisible();
  await expect(page.locator('.nb-acitem').first()).toContainText('CaptainEliThorne');
  await beat(page, 700);
  await page.keyboard.press('Enter'); // accept the @npc suggestion
  await ta.pressSequentially('warned the party off the pier.', { delay: 40 });
  await page.keyboard.press('Enter'); // save
  await expect(page.locator('.nbe-row')).toHaveCount(3);
  await beat(page);

  // 4 — live-preview markdown: heading + todo render as you type.
  await caption(page, 'Live preview — headings, bullets & tokens as you type');
  await ta.click();
  await ta.pressSequentially('## Open clues', { delay: 45 });
  await page.keyboard.press('Shift+Enter');
  await ta.pressSequentially('- [ ] recover the drowned amulet #clue', { delay: 40 });
  await beat(page, 900);
  await page.keyboard.press('Escape'); // dismiss any tag popup
  await page.keyboard.press('Enter'); // save
  await expect(page.locator('.nbe-row')).toHaveCount(4);
  await beat(page);

  // 5 — search filters the timeline; a live match count appears.
  await caption(page, 'Search — instant filter with a live match count');
  const search = page.locator('.nbe-search');
  await search.click();
  await search.pressSequentially('cult', { delay: 120 });
  await expect(page.locator('.nbe-mcount')).toBeVisible();
  await beat(page, 1100);
  await search.fill('');
  await beat(page, 500);

  // 6 — focus a note → context + tags detail panel on the right.
  await caption(page, 'Focus a note — context stamp, tags & attachments');
  await page.locator('.nbe-row').first().click();
  await expect(page.locator('.nbe-right .nbe-card').first()).toBeVisible();
  await beat(page, 1100);

  // 7 — click a tag chip to filter the whole timeline by that tag.
  await caption(page, 'Tag chips — one click filters the whole timeline');
  await page.locator('.nbe-chip', { hasText: 'innsmouth' }).first().click();
  await expect(page.locator('.nbe-fchip')).toBeVisible();
  await beat(page, 1100);
  await page.locator('.nbe-fchip').click(); // clear the filter
  await beat(page, 500);

  // 8 — recap generator: turn the session's notes into "Previously on…".
  await caption(page, 'Recap generator — notes → “Previously on…”');
  await page.getByRole('button', { name: 'Generate recap' }).click();
  await expect(page.locator('.nbe-rtext')).toBeVisible();
  await beat(page, 1400);

  // 9 — push that recap to the shared Broadcast window as parchment.
  await caption(page, 'Push the recap to the shared Broadcast — parchment read-aloud');
  const view = await context.newPage();
  await view.goto('/broadcast.html');
  await page.getByRole('button', { name: 'Push to broadcast caption' }).click();
  await expect(view.getByRole('heading', { name: 'Previously on…' })).toBeVisible({ timeout: 5000 });
  await view.bringToFront();
  await beat(page, 1600);

  await caption(page, 'Session Notes — capture, recall, and broadcast');
  await beat(page, 1400);
});
