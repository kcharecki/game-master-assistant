# GM Assistant

GM-only virtual desktop for running online tabletop RPG sessions (D&D 5e / Call of Cthulhu).
Design, architecture, module contract, and working notes: [CLAUDE.md](CLAUDE.md).

## Stack
Pure web · Svelte 5 + TypeScript · Vite · IndexedDB (`idb`) · Vitest + Playwright + ESLint.

## Architecture
Three surfaces (desktop / editor tabs / broadcast) + self-contained modules. Full detail in
[CLAUDE.md](CLAUDE.md).
- **GM app** (`index.html`): private desktop of draggable windows.
- **Broadcast renderer** (`broadcast.html`): the shared page; screen-share only this.
- GM → Broadcast over **BroadcastChannel** (`src/lib/bus.ts`); state mirrored to IndexedDB
  (`src/lib/db.ts`) so the broadcast tab rehydrates on open.

## Quickstart
```bash
npm install
npm run dev        # GM app at /, broadcast at /broadcast.html
```

Open the GM app, click **Open Broadcast ↗** (or visit `/broadcast.html`), then **Reveal** in the
dock to push content. Screen-share the broadcast tab to players.

## Scripts
| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck (`svelte-check`) + production build |
| `npm run check` | Typecheck only |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e (builds + previews first) |

## Layout
```
index.html / broadcast.html   entry pages (Vite multi-page)
src/
  App.svelte                  workspace shell: desktop + editor tabs
  main.ts                     GM mount
  app.css                     Keeper design tokens
  lib/
    module.ts                 ModuleManifest contract + ModuleId
    registry.ts               id -> module (single source of truth)
    bus.ts                    BroadcastChannel link
    db.ts                     IndexedDB (kv + asset stores)
    types.ts                  shared types
    actions/drag.ts           window drag
    stores/windows.svelte.ts  window manager (sizes from registry)
  surfaces/                   Desktop.svelte, EditorHost.svelte
  components/                 WindowFrame, Topbar, Sidebar, Dock, KeeperEye, Stub
  modules/<id>/               manifest + Desktop/Editor/store + co-located *.test.ts
                              (17 shipped: initiative, npcs, lore, map, audio, planner, …)
  broadcast/                  broadcast renderer
tests/
  unit/                       cross-cutting Vitest (bus, windows)
  e2e/                        Playwright
```

## Add a module
1. `src/modules/<id>/index.ts` exporting a `ModuleManifest` (+ `Desktop.svelte` / `Editor.svelte` / `store.svelte.ts` as needed).
2. Register it in `src/lib/registry.ts` and add `<id>` to `ModuleId` in `src/lib/module.ts`.
3. Co-locate `*.test.ts`. Each view depends only on its own store + props, so it tests in isolation.
