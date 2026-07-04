
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
