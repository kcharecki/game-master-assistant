
# General suggestions
1. Answer in concise manner
2. Notes and documents should be also very concise

# GM Assistant App — Feature Brainstorm

A virtual "desktop / operating system" for a single Game Master to organise everything needed to run an online session (D&D, Call of Cthulhu, etc.). Modules live as separate windows/tabs.

**Core constraint:** No player accounts or sign-ins. This is a GM-only tool. Players see things only via the GM **screen-sharing a single broadcast window** — there is no per-player messaging or device sync. Everything else is GM-eyes-only by default.

`src/lib/registry.ts` is the source of truth for what ships. Modules take turns being the thing
shown in the one broadcast window (reveal / player-display / battle map+tokens+ping / audio); all
other modules are GM-eyes-only.

# Styling — Unified Design System is the baseline

**All styling MUST derive from the Unified Design System brief.** It is the canonical, read-only
source of truth for the app's visual language — tokens, components, states, and the Stage render
language. When you build or restyle any component, match this baseline; do not invent new colors,
radii, spacing, or hover/focus treatments.

- **Design catalog** → `Unified Design System brief/Design System.dc.html` (tokens + every component
  in all states + the "What changed & why" refactor map).
- **Stage reference layout** → `Unified Design System brief/Stage Showcase.dc.html`.
- **Do not edit** anything in `Unified Design System brief/` unless explicitly told to — treat as read-only.

The design tokens map 1:1 onto `src/app.css` `:root` custom properties. The current implementation is
the **reference, not the target** — it drifted component-by-component and must converge to the brief.
Core rules: **gold means on-air only** (selection is green, armed is green-dashed); one input well
(`bg/1 #0B1310`); radii collapse to 4 + pill (r/1 4 · r/2 7 · r/3 10 · r/4 14); one label style
(10.5px / .14em / 600); tabular Cormorant for all numerals (not Georgia); line hue is
`rgba(134,178,153,*)` at .14/.28/.45.

# Project status & where things live

Pure-web Svelte 5 + TS, three surfaces (desktop / editor tabs / broadcast), IndexedDB persistence,
`BroadcastChannel` single shared window. Green gate + commit per component: `npm run check` · `lint` ·
`test` (Vitest, co-located `*.test.ts`) · `build`.

**Test rule — every module with state ships tests.** A module that has `store.svelte.ts` MUST have a
co-located `store.test.ts`; a module with `logic.ts` MUST have `logic.test.ts`. Mock `lib/db`
(`kvGet`/`kvSet`) at the top so state is tested pure — no IndexedDB, no DOM (see
`src/modules/timer/store.test.ts`). Cover every state transition and pure helper the store exports.
When you touch a store or its logic, update the test in the same change — never ship or edit
`store.svelte.ts`/`logic.ts` without its `*.test.ts` green. Current gaps to backfill: `calendar` and
`handouts` (store, no store.test); `initiative` (has store.test, no `logic.ts`/logic tests).

- **Not all 40 vision features are built.** `src/lib/registry.ts` is the source of truth. Some ids
  (statblock, factions, clues, skillcheck, tables/loot, dashboard, spotlight, reminders, improv,
  archive) may still have i18n strings but no module/UI.
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

# Architecture — one origin, three surfaces + self-contained modules

**Surfaces** (GM app is `index.html`, switched via the top tab strip):
1. **Desktop** (`src/surfaces/Desktop.svelte`) — live play. Draggable windows, each hosts a module's
   *desktop view*; position/state via `wm` (`lib/stores/windows.svelte.ts`).
2. **Editors** (`src/surfaces/EditorHost.svelte` + tab strip in `App.svelte`) — authoring tabs, each
   hosts a module's *editor view*.
3. **Broadcast** (`broadcast.html` → `src/broadcast/Broadcast.svelte`) — a **separate** window
   (`window.open('broadcast.html')`) driven over `BroadcastChannel`. The screen-shared, player-facing
   page. Screen-share **only this** tab.

**Module contract** (`src/lib/module.ts`): a module = one feature owning its state + up to three views.
`ModuleManifest { id: ModuleId; title; size:{w;h}; desktop?; editor?; broadcast?; broadcastable? }`.
Registered in `registry.ts`; surfaces resolve views by `ModuleId` and **never import module internals**.
Add a feature = folder under `src/modules/<id>/` + one registry line. Folder:
```
src/modules/<id>/
  index.ts         manifest (default export)
  Desktop.svelte   live widget      (optional)
  Editor.svelte    authoring view   (optional)
  store.svelte.ts  module state     (optional)
  logic.ts         pure helpers     (optional)
  *.test.ts        unit tests       (co-located)
```

**Broadcast link** (`src/lib/bus.ts` + `lib/db.ts`): GM components call `createBus().send(payload)` to
put content on air. `BroadcastPayload` is a small discriminated union (`clear | text | image | map |
grid`); the broadcast page switches on `payload.kind` — decoupled from the registry. Every send is
mirrored to IndexedDB `kv:broadcastState`, so the broadcast tab **rehydrates** on open. IndexedDB is
reached only through `lib/db.ts` (`kvGet`/`kvSet`), which is `vi.mock`-ed in unit tests.

**Testability** (rule: every component stands alone): logic/stores are pure (`logic.ts`,
`store.svelte.ts`) — Vitest, no DOM. Components render in isolation (jsdom) — a module's Desktop/Editor
mounts without surfaces because it depends only on its own store + props (`createBus` called lazily in
handlers, never at import). Surfaces are thin shells, covered by Playwright e2e.

```
Editor view  ──edit asset──> module store ──persist──> IndexedDB
Desktop view ──"on air"────> bus.send(payload) ──BroadcastChannel──> Broadcast page
                                   └──mirror──> IndexedDB (rehydrate on open)
```

# Working style — delegate to keep the main thread light

- **Prefer parallel subagents.** Offload anything self-contained so the main session stays low-context:
  codebase spelunking / "where is X" (Explore or `cavecrew-investigator`), bounded 1–2 file edits
  (`cavecrew-builder`), diff review (`cavecrew-reviewer`), and independent chunks of a larger task
  (spec extraction, i18n parity, a sibling component). Fan out **several workers in parallel** when the
  pieces don't depend on each other, then integrate their results on the main thread.
- Keep the main thread for orchestration, integration, and the visual iterate loop (build → static →
  screenshot). Push discovery/bulk edits to workers; relay only what matters back.
- A reusable "apply a design to a module" prompt for fresh sessions lives in `prompts/apply-design.md`.

# Gotchas & tooling (learned the hard way)

- **CSS class collisions with global `app.css`.** Svelte scopes a component's *own* rules, but global
  `app.css` rules still match the same class names on your elements. Generic names (`.cap`, `.in`,
  `.row`, `.btn`, `.card`, `.chip`, `.search`, `.muted`, `.find`, `.save`) silently pick up global
  styles — e.g. global `.cap { align-items:center }` shrink-wrapped the Session Notes capture box.
  **Prefix every module component class** with a module-unique token (`nb-`/`nbe-`/`nbw-` in notebook).
- **The in-app browser/MCP screenshot action times out — even on a trivial static page.** It hangs the
  full 30s regardless of the page (verified against a bare `<h1>` served by `python -m http.server` — no
  fonts, scripts, or animation). Tool/sandbox limitation, NOT an app / font-404 / CSS-animation issue;
  don't chase it in code. Two working ways to see pixels:
  - **Real PNGs → `npm run build && npm run shot`** (`scripts/shot.mjs`). Drives Playwright's own
    headless Chromium (a devDep already), serves `dist/` on an ephemeral port, and writes
    `screenshots/<c>.png` for each preview target. Point `src/preview/Preview.svelte` at the module
    first; default targets are `widget` + `editor`. Custom: `node scripts/shot.mjs widget:440x520
    editor:1100x720` (`<?c= value>:<w>x<h>`). `screenshots/` is gitignored. `Read` the PNG to view it.
  - **Structure/text only → `read_page`** on the MCP browser (works fine; returns the accessibility
    tree). Enough to confirm a component renders and its control/label state.
  (Font files `IMFellEnglish-*`/`Cormorant-*.woff2` are absent from `public/fonts/`, so the `@font-face`
  404s and the serif fallback stack carries — intentional per `app.css`.)
- **Component preview harness** (`preview.html` + `src/preview/`): dev-only page that mounts individual
  module components with deterministic mock data on a bare dark background — no app shell, no broadcast
  iframe. Added to vite build inputs so it lands in `dist/` (harmless if shipped). URL params:
  `?c=widget|editor`, `?q=<search>`, `?tag=<tag>`. Use it to iterate a component and screenshot it in
  isolation instead of the whole app. Extend `Preview.svelte` to add more components.
- **Session Notes v2 look:** gold (`--gold`) + serif (`--serif`) theme. `@npc` / `#tag` / `[[wikilink]]`
  render gold everywhere. The capture box is a **live-preview mirror**: a transparent-text `<textarea>`
  over a styled mirror `<div>`; markers (`## `, `- `) are kept but hidden/dimmed so char widths match
  and the caret stays aligned (true bold/size changes on headings cause minor drift — accepted).
- **Iterating on visuals (workflow):** don't eyeball the whole app. 1) point the harness
  (`src/preview/Preview.svelte`) at the component, 2) `npm run build`, 3) `npm run shot` → `Read` the
  `screenshots/*.png`, 4) compare to the design mock, 5) edit CSS, repeat from step 2. Verify non-visual
  behaviour with `read_page` on the MCP browser against the `static` launch server (`dist/` on :8794).
  Green gate before commit: `check · lint · test · build`.
