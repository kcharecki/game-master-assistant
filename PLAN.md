# GM Assistant — Design decisions & status

Architecture + how to add a module: [ARCHITECTURE.md](ARCHITECTURE.md). Stack + quickstart:
[README.md](README.md). Feature vision: [gm-assistant-features.md](gm-assistant-features.md). Design
tokens: [`src/app.css`](src/app.css).

## Locked decisions
- **GM-only**, no player accounts. Players see ONE screen-shared broadcast window; all else GM-eyes-only.
- Pure web (browser), no install; optional Tauri wrapper deferred post-v1.
- Svelte 5 + TS + Vite; IndexedDB (`idb`) persistence with export/import backup; same-origin.
- Design: "Keeper · Command Deck" séance-green desktop (compact + AA-accessible); tokens in `src/app.css`.
- Genre-neutral modules where possible; system switch (D&D 5e ⇄ CoC 7e) swaps system-specific widgets
  (CR/encounter ⇄ Sanity) + dice mode.

## Status
17 modules ship (`src/lib/registry.ts`) across desktop / editor / broadcast surfaces. Not all 40 features
from the vision are built — unbuilt: statblock / encounter builder, faction web, clue board, skill-check
helper, random tables / loot, player dashboard, spotlight, legendary/lair reminders, improv, campaign
archive (some have leftover i18n strings only).

## Open questions
- Tauri wrapper (multi-window on a 2nd monitor, local SQLite) — deferred; web is the target.
- IndexedDB quota strategy for large audio libraries.
- Campaign archive search: client-side index vs SQLite-on-Tauri later.
