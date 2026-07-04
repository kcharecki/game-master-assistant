# GM Assistant — Build Plan

## Chosen Design
**"Keeper · Command Deck" — séance-green Cthulhu desktop** (compact + AA-accessible). All UI follows
this direction. Design tokens (palette, type, borders, density, a11y) are the source of truth in
[`src/app.css`](src/app.css); Georgia serif for big numerals + scene titles, hairline green borders,
animated Keeper eye.

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

## Windows / modules
Built as desktop windows / editor tabs; all 18 shipped. Feature → module map in [ROADMAP.md](ROADMAP.md);
feature spec in [gm-assistant-features.md](gm-assistant-features.md).

## Window system
- [x] Drag + **resize** handles
- [x] **Minimize / close**, restore from dock
- [x] **＋ Widget** menu → spawn any module window
- [ ] Snap-to-grid + saved **layout presets** per system (D&D vs CoC)
- [x] Persist window positions/state

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
  Payload kinds: `clear | text | image | map | ping | audio`, plus a separate `display` message (cinematic/plain framing).
- Broadcast state mirrored in IndexedDB `kv` so the broadcast tab **rehydrates** on open/refresh.
- GM spawns broadcast window with `window.open` (user gesture) → place on shared screen / 2nd monitor.
- GM **screen-shares only the broadcast tab/window**; control tab stays private. = CLAUDE.md "one broadcast window".
- Backgrounded GM tab may throttle timers; broadcast tab is visible (shared) so unaffected.

## Status
All milestones M0–M7 shipped and green (v1.0). See [ROADMAP.md](ROADMAP.md) for the milestone log,
the 40-feature → module map, and the v1.0 summary.

## Open questions
- Tauri wrapper (multi-window placement, local SQLite) — **deferred post-v1**; web app is the v1 target.
- Asset import limits / IndexedDB quota strategy for large audio.
- Campaign archive search: client-side index vs SQLite-on-Tauri later.
