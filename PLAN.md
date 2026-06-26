# GM Assistant — Build Plan

## Chosen Design
**[mockup-11.html](mockups/mockup-11.html) — "Keeper" / séance-green desktop.** All UI work follows this direction.
Explore alternates: [mockups/index.html](mockups/index.html).

### Locked design tokens (from mockup-11)
- Palette: deep desaturated greens. bg `#080d0b`, panels `#0f1815`/`#13201b`, accent green `#5fbf8f` / glow `#39d98a`, danger red `#c05b5b`, gold note `#c7a44e`.
- Type: system-ui body; Georgia serif for big numerals (dice, initiative) + scene titles.
- Borders hairline green `rgba(95,150,120,.16)`; soft shadows; 12px radius.

### Core UX model
- **Desktop canvas**: components are draggable floating **windows** on a grid+vignette wallpaper. Click = focus/raise (z-index). Position clamped to canvas.
- **Left rail**: persistent nav for asset setup (Scenes, NPCs, Items, Handouts, Calendar, Library, Settings).
- **Top bar**: campaign + moon phase, session/real time, player count, audio/calendar/settings.
- **Bottom dock**: live session actions (Narrate, Reveal, Add NPC/Item, Roll Table, Timer, Conditions, Summary) + **＋ Widget** launcher to spawn windows.
- **Keeper Panel**: animated all-seeing eye (SVG, pulse + blink) — signature element.

## Constraints (from CLAUDE.md)
- GM-only. No player accounts/sign-in.
- Players see ONE screen-shared broadcast/reveal window. All else GM-eyes-only.
- Single Game Master tool.

## Windows / modules (initial set)
Built as desktop windows; full list in [gm-assistant-features.md](gm-assistant-features.md).
- Live now in mockup: Current Scene, Initiative Tracker, Quick Roller (d100 + Chaos/Sanity), NPCs, Handouts, Notebook.
- Next: Reveal/broadcast window, Battle map + tokens + fog, Ambient audio + soundboard, Clue board, Calendar/timeline.

## Window system — to implement
- [ ] Drag (done in mockup) + **resize** handles
- [ ] **Minimize / close**, restore from dock
- [ ] **＋ Widget** menu → spawn any module window
- [ ] Snap-to-grid + saved **layout presets** per system (D&D vs CoC)
- [ ] Persist window positions/state

## System flexibility
- Keep modules genre-neutral where possible (fits D&D + Call of Cthulhu).
- System switch swaps system-specific widget (CR/encounter ⇄ Sanity) + rules/dice mode.

## Locked assumptions (stack)
- **Runtime:** pure web (browser). No install. Optional Tauri wrapper later.
- **Frontend:** Svelte 5 + TypeScript, built with Vite.
- **Persistence:** IndexedDB (via `idb`). Stores campaigns/NPCs/scenes/handouts/notes + asset blobs (audio/images) + `kv` for window layout & broadcast state. Export/import = backup.
- **Tooling:** Vitest (unit), Playwright (e2e: windows, DnD, broadcast), ESLint + Prettier, `svelte-check` typecheck.
- Same-origin only (one app).

## Broadcast architecture (locked)
- Two pages, same origin: **GM app** (`index.html`, private desktop) and **Broadcast renderer** (`broadcast.html`, the shared one).
- GM → Broadcast control via **BroadcastChannel** (`gm-assistant` channel). Live, pub/sub, no handle needed.
- Broadcast state mirrored in IndexedDB `kv` so the broadcast tab **rehydrates** on open/refresh.
- GM spawns broadcast window with `window.open` (user gesture) → place on shared screen / 2nd monitor.
- GM **screen-shares only the broadcast tab/window**; control tab stays private. = CLAUDE.md "one broadcast window".
- Backgrounded GM tab may throttle timers; broadcast tab is visible (shared) so unaffected.

## Open questions
- Tauri wrapper timing (multi-window placement, local SQLite) — defer.
- Asset import limits / IndexedDB quota strategy for large audio.
- Campaign archive search: client-side index vs SQLite-on-Tauri later.
