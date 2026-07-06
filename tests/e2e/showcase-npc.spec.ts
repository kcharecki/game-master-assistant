import { test, expect } from '@playwright/test';
import { installCursor, caption, beat } from './showcase-util';

/**
 * SHOWCASE (not a pass/fail gate) — drives the real NPCs "rolodex" editor to
 * record the NPC-creation flow end to end:
 *   New NPC  →  fill the dossier form (identity, voice, a stat, public blurb,
 *   GM-only notes)  →  Done flips it into the manila dossier card  →
 *   Reveal to players → the player-safe projection lands on the Broadcast.
 *
 * Run on its own:  npx playwright test showcase-npc
 *   → video at  test-results/…-showcase-npc-…/video.webm
 */
test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: 'on', size: { width: 1280, height: 800 } },
});

test('NPC creation — feature showcase', async ({ page, context }) => {
  await installCursor(page);
  await page.goto('/');
  await expect(page.locator('.desktop')).toBeVisible();

  // 1 — open the NPCs editor (the rolodex) from the left rail.
  await caption(page, 'NPC Roster — open the rolodex');
  await page.getByRole('link', { name: 'NPCs' }).click();
  await expect(page.locator('.rolodex')).toBeVisible();
  await beat(page);

  // 2 — start a blank dossier: "New NPC" flips a card into edit mode.
  await caption(page, 'New NPC — start a blank dossier');
  await page.getByRole('button', { name: 'New NPC' }).click();
  await expect(page.locator('.npcform')).toBeVisible();
  await beat(page);

  const form = page.locator('.npcform');

  // 3 — identity: name, role, disposition.
  await caption(page, 'Identity — name, role & disposition');
  await form.locator('.in.name').click();
  await form.locator('.in.name').pressSequentially('Silas Marsh', { delay: 55 });
  await page.getByPlaceholder('Role / location').pressSequentially('Fishmonger · Innsmouth docks', { delay: 30 });
  await form.locator('.portrow select').selectOption('hostile');
  await beat(page);

  // 4 — voice notes (for in-the-moment roleplay).
  await caption(page, 'Voice notes — stay in character on the fly');
  await page.getByPlaceholder('Voice / accent notes').pressSequentially('wet, gurgling drawl; never blinks', { delay: 30 });
  await beat(page);

  // 5 — structured stat block: add a characteristic row.
  await caption(page, 'Characteristics — a structured stat block');
  await page.getByRole('button', { name: '＋ row' }).first().click();
  await page.getByPlaceholder('Key (STR, HP, DB…)').first().pressSequentially('HP', { delay: 45 });
  await page.getByPlaceholder('Value').first().pressSequentially('13', { delay: 45 });
  await beat(page);

  // 6 — the public / private split: blurb players may see vs GM-only secrets.
  await caption(page, 'Public blurb — what players are allowed to learn');
  await page
    .getByPlaceholder('What players are allowed to learn about this NPC…')
    .pressSequentially('A dour fishmonger who watches strangers a beat too long.', { delay: 18 });
  await beat(page);

  await caption(page, 'GM notes — secrets that never reach the broadcast');
  await page
    .getByPlaceholder('Secrets, plot hooks, true motives — GM eyes only…')
    .pressSequentially('Deep One hybrid. Reports the party to the Esoteric Order.', { delay: 18 });
  await beat(page);

  // 7 — Done flips the form back into the finished manila dossier card.
  await caption(page, 'Done — the finished dossier card');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.card .nm')).toContainText('Silas Marsh');
  await beat(page, 1300);

  // 8 — Reveal to players: only the player-safe projection crosses to Broadcast.
  await caption(page, 'Reveal to players — only the public view is broadcast');
  const view = await context.newPage();
  await view.goto('/broadcast.html');
  await page.getByRole('button', { name: 'Reveal to players' }).click();
  await expect(view.getByText('Silas Marsh').first()).toBeVisible({ timeout: 5000 });
  await view.bringToFront();
  await beat(page, 1600);

  await caption(page, 'NPC dossier — GM-private, one click to reveal');
  await beat(page, 1400);
});
