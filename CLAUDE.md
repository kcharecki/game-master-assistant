
# General suggestions
1. Answer in concise manner
2. Notes and documents should be also very concise

# GM Assistant App — Feature Brainstorm

A virtual "desktop / operating system" for a single Game Master to organise everything needed to run an online session (D&D, Call of Cthulhu, etc.). Modules live as separate windows/tabs.

**Core constraint:** No player accounts or sign-ins. This is a GM-only tool. Players see things only via the GM **screen-sharing a single broadcast window** — there is no per-player messaging or device sync. Everything else is GM-eyes-only by default.

List of features is inside @gm-assistant-features.md

# Project status & where things live

Pure-web Svelte 5 + TS, three surfaces (desktop / editor tabs / broadcast), IndexedDB persistence,
`BroadcastChannel` single shared window. Green gate + commit per component: `npm run check` · `lint` ·
`test` (Vitest, co-located `*.test.ts`) · `build`.

- **Architecture, module contract, how to add a module** → @ARCHITECTURE.md (read this first).
- **Feature spec** → @gm-assistant-features.md. Note: not all 40 features are built — `src/lib/registry.ts`
  is the source of truth for what actually ships. Several feature ids (statblock, factions, clues,
  skillcheck, tables/loot, dashboard, spotlight, reminders, improv, archive) have i18n strings but no
  module/UI yet.
- **Modules live in `src/modules/<id>/`** — 17 shipped: initiative, timer, roller, npcs, lore,
  calendar, reveal, map, audio, handouts, notebook, planner, sanity, palette, rules, stage, preview.
  Registered in `src/lib/registry.ts`; ids in `src/lib/module.ts`. (`mood` is a broadcast layer in
  `src/broadcast/mood.ts`, not a standalone module.)
- A module = `index.ts` (manifest) + optional `Desktop.svelte` / `Editor.svelte` / `store.svelte.ts` /
  `logic.ts` + `*.test.ts`. Surfaces resolve views by `ModuleId`; never import module internals.
- **`planner`** = session planning: beat rail, branching "if players…" forks, run cursor, `@npc` /
  `[[lore]]` reference chips, plot-thread rail, read-aloud → broadcast (parchment via `putOnAir`).
  Supersedes the originally-planned separate `beats` / `quests` ids.
- i18n (en/pl) in `src/lib/i18n/messages/*.ts`; module titles in `shell.ts` must match manifest titles.

# Gotchas & tooling (learned the hard way)

- **CSS class collisions with global `app.css`.** Svelte scopes a component's *own* rules, but global
  `app.css` rules still match the same class names on your elements. Generic names (`.cap`, `.in`,
  `.row`, `.btn`, `.card`, `.chip`, `.search`, `.muted`, `.find`, `.save`) silently pick up global
  styles — e.g. global `.cap { align-items:center }` shrink-wrapped the Session Notes capture box.
  **Prefix every module component class** with a module-unique token (`nb-`/`nbe-`/`nbw-` in notebook).
- **Screenshots fail on any Vite dev page.** The HMR WebSocket never goes network-idle, so
  `preview_screenshot` hangs the full 30s and times out (all app pages, incl. bare ones). Static pages
  (served by `python -m http.server`) screenshot fine. To see real pixels: `npm run build` then serve
  `dist/` statically (there's a `static` config in `.claude/launch.json` → `dist/` on :8794).
- **Component preview harness** (`preview.html` + `src/preview/`): dev-only page that mounts individual
  module components with deterministic mock data on a bare dark background — no app shell, no broadcast
  iframe. Added to vite build inputs so it lands in `dist/` (harmless if shipped). URL params:
  `?c=widget|editor`, `?q=<search>`, `?tag=<tag>`. Use it to iterate a component and screenshot it in
  isolation instead of the whole app. Extend `Preview.svelte` to add more components.
- **Session Notes v2 look:** gold (`--gold`) + serif (`--serif`) theme. `@npc` / `#tag` / `[[wikilink]]`
  render gold everywhere. The capture box is a **live-preview mirror**: a transparent-text `<textarea>`
  over a styled mirror `<div>`; markers (`## `, `- `) are kept but hidden/dimmed so char widths match
  and the caret stays aligned (true bold/size changes on headings cause minor drift — accepted).
- **Iterating on visuals (workflow):** don't eyeball the whole app. 1) add/point the harness at the
  component, 2) `npm run build`, 3) start the `static` launch server, 4) `preview_screenshot` the
  `dist/preview.html?c=…` URL, 5) compare to the design mock, 6) edit CSS, repeat from step 2. Verify
  non-visual behaviour with `preview_eval`/`preview_inspect` (those work on dev too). Green gate before
  commit: `check · lint · test · build`.
