# Roadmap

**Goal:** ship the GM Assistant from [gm-assistant-features.md](gm-assistant-features.md) as a pure-web
Svelte app — three surfaces (desktop / editor tabs / broadcast), each feature a self-contained,
independently testable module. Build incrementally; every component lands green and committed.

## Working agreement (the gate)
A step is **done** only when all pass, in order:
1. `npm run check` — 0 type errors
2. `npm run lint` — clean
3. `npm test` — all unit tests pass (the new component ships with co-located `*.test.ts`)
4. `npm run build` — succeeds
5. **commit** the step (one component / one logical step per commit)

Never start the next step on a red tree. If a step can't go green, revert or stash — keep `main` always
building. Run `npm run test:e2e` at each **milestone checkpoint** (not every commit — it's slower).

## Commit convention
- Conventional commits, imperative, scoped to the module/area:
  - `feat(initiative): real combatant store with add/remove/next-turn`
  - `test(map): fog reveal grid unit tests`
  - `fix(bus): close channel on broadcast unmount`
  - `refactor(registry): …`, `chore: …`, `docs: …`
- One component or one cohesive step per commit. Body = why, not what, when non-obvious.
- End every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Per-component checklist (repeat each module view)
- [ ] `store.svelte.ts` / `logic.ts` first, with unit test (no DOM)
- [ ] `Desktop.svelte` and/or `Editor.svelte` reading only own store + props
- [ ] `createBus` (if used) called lazily in handlers — no import-time side effects
- [ ] manifest in `index.ts`, registered in `lib/registry.ts`, id in `lib/module.ts`
- [ ] gate (check/lint/test/build) → commit

## Checkpoints
At the end of each milestone: run e2e, update [PLAN.md](PLAN.md) status, tag a checkpoint
`git tag mN-<name>`, and write a one-line CHANGELOG entry.

---

## Milestones

### M0 — Foundation ✅ (committed)
Harness, 3-surface architecture, registry, drag windows, broadcast link, IndexedDB. Modules: scene,
initiative (static), roller, npcs (editor), reveal. `tag: m0-foundation`

### M1 — Core play loop
Live-at-the-table essentials. Commit per row.
- [x] initiative: real store (add/remove/reorder, **next turn**, round counter) + test
- [x] initiative: HP / AC / conditions per combatant + hidden HP & "bloodied"
- [x] conditions & duration tracker (auto-expire countdown) + test
- [x] roller: macros, advantage/disadvantage, **hidden GM roll** + test
- [x] session timer & pacing bar + break reminder
- [x] window system: **resize** handles, **minimize-to-dock**, real ＋Widget menu + e2e
- *checkpoint:* `m1-core`

### M2 — Broadcast & maps (the shared surface) ✅
- [x] reveal: image upload to IndexedDB assets (not just URL) + test
- [x] player-facing display mode (clean broadcast theme)
- [x] battle map: grid + pan/zoom; tokens (drag, snap, HP/conditions) + test
- [x] fog of war reveal (paint/erase) → broadcast `map` payload + test
- [x] ping/pointer tool
- [x] audio: ambient player (scene playlists, crossfade) + soundboard, routed to broadcast
- *checkpoint:* `m2-broadcast`

### M3 — NPCs & world ✅
- [x] npcs: portraits (asset store), full roster view, search
- [x] random NPC generator (name/trait/motivation) + test
- [x] lore wiki: cross-linked pages, backlinks + test
- [x] in-world calendar & timeline (moon phases, events)
- [x] faction & relationship web (SVG graph)
- *checkpoint:* `m3-world`

### M4 — Investigation & system flexibility ✅
- [x] system switch **D&D 5e ⇄ CoC 7e** (swaps system-specific widgets + dice mode)
- [x] sanity tracker (per-investigator SAN, quick SAN-loss) + test
- [x] clue / investigation board (red-string corkboard) + test
- [x] skill-check helper (opposed/threshold, system-tuned) + test
- [x] stat block manager + encounter builder w/ CR readout (D&D) + test
- *checkpoint:* `m4-systems`

### M5 — Prep & notes ✅
- [x] session notes (timestamped, taggable, searchable) + test
- [x] quest & plot-thread tracker + test
- [x] scene/beat planner (movable cards)
- [x] rulings log, custom random tables, loot generator + tests
- [x] recap generator, improv prompt button
- *checkpoint:* `m5-prep`

### M6 — Cross-cutting ✅
- [x] command palette / global search (⌘K over all modules) + test
- [x] layout presets per system (save/restore window arrangement)
- [x] campaign archive (cross-session search)
- [x] persistence polish: export/import campaign file, IndexedDB quota handling
- [x] stragglers: handouts, spotlight (#15), mood/lighting (#19), rules (#21),
      player dashboard (#12), legendary/lair reminders (#4)
- *checkpoint:* `m6-utility`

### M7 — Hardening
- [ ] e2e coverage across surfaces, a11y pass, perf
- [ ] optional Tauri wrapper (native multi-window broadcast, local files)
- *checkpoint:* `v1.0`

## Definition of "everything done"
All M1–M6 feature rows green + committed, M7 hardening passed, e2e suite covers each surface, and the
40-feature list in [gm-assistant-features.md](gm-assistant-features.md) is mapped to a shipped module.

### 40-feature → module map (all mapped ✅)
| # | Feature | Module id |
|---|---------|-----------|
| 1 | Initiative tracker | `initiative` |
| 2 | Stat block manager | `statblock` |
| 3 | Condition & duration tracker | `conditions` |
| 4 | Legendary/lair action reminders | `reminders` |
| 5 | Encounter builder (CR readout) | `statblock` |
| 6 | Hidden HP & "bloodied" flags | `initiative` |
| 7 | NPC roster | `npcs` |
| 8 | Random NPC generator | `npcs` |
| 9 | Faction & relationship web | `factions` |
| 10 | Lore wiki | `lore` |
| 11 | In-world calendar & timeline | `calendar` |
| 12 | Player dashboard | `dashboard` |
| 13 | Reveal window | `reveal` + `handouts` |
| 14 | Recording & playback | `audio` |
| 15 | Spotlight tracker | `spotlight` |
| 16 | Player-facing display mode | `reveal` (broadcast display) |
| 17 | Ambient music player | `audio` |
| 18 | Sound effect soundboard | `audio` |
| 19 | Mood/lighting presets | `mood` (broadcast) |
| 20 | Dice roller with macros | `roller` |
| 21 | Searchable rules reference | `rules` |
| 22 | Rulings log | `tables` |
| 23 | Custom random tables | `tables` |
| 24 | Session notes | `notebook` |
| 25 | Scene/beat planner | `beats` |
| 26 | Quest & plot-thread tracker | `quests` |
| 27 | Recap generator | `notebook` |
| 28 | Improv prompt button | `improv` |
| 29 | Battle map with fog of war | `map` |
| 30 | Token management | `map` |
| 31 | Ping/pointer tool | `map` |
| 32 | Session timer & pacing bar | `timer` |
| 33 | Break reminder | `timer` |
| 34 | Sanity tracker | `sanity` |
| 35 | Clue/investigation board | `clues` |
| 36 | Skill-check helper | `skillcheck` |
| 37 | Command palette / global search | `palette` |
| 38 | Loot & treasure generator | `tables` |
| 39 | Layout presets | `lib/layouts` + Topbar |
| 40 | Campaign archive | `archive` |

Notes: #16 and #19 are presentational layers of the broadcast surface (display mode / mood) rather than
standalone modules. #14's clip import/playback ships in `audio`; live mic capture is a future hardening
item. `scene` (current-scene board) and the `lib/backup` export/import are supporting infrastructure not
in the original 40.
