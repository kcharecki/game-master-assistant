# Architecture

The app is **one origin, three surfaces**, and a set of self-contained **modules**.

## Surfaces
1. **Desktop** (`src/surfaces/Desktop.svelte`) — live play. Draggable windows; each window hosts a
   module's *desktop view*. Window position/state managed by `wm` (`lib/stores/windows.svelte.ts`).
2. **Editors** (`src/surfaces/EditorHost.svelte` + tab strip in `App.svelte`) — authoring/customization
   of assets (NPCs, maps, scenes, reveal content…). Each editor tab hosts a module's *editor view*.
3. **Broadcast** (`broadcast.html` → `src/broadcast/Broadcast.svelte`) — the screen-shared, player-facing
   page. Renders whatever the GM puts "on air" via the bus. Screen-share **only this** tab.

Desktop and Editors live in the GM app (`index.html`), switched via the top tab strip. Broadcast is a
separate window (`window.open('broadcast.html')`), driven over `BroadcastChannel`.

## Module contract (`src/lib/module.ts`)
A module = one feature, owning its state + up to three views:
```ts
interface ModuleManifest {
  id: ModuleId;                 // 'npcs' | 'map' | 'reveal' | ...
  title: string;
  size: { w; h };               // default desktop window size
  desktop?:   Component;        // live windowed widget
  editor?:    Component;        // full authoring tab
  broadcast?: Component;        // (optional) player render hint
  broadcastable?: boolean;      // can be put on air
}
```
Modules are registered in `src/lib/registry.ts`. Surfaces look up views by `ModuleId` — they never
import module internals. Add a feature = add a folder under `src/modules/<id>/` + one registry line.

```
src/modules/<id>/
  index.ts         manifest (default export)
  Desktop.svelte   live widget        (optional)
  Editor.svelte    authoring view     (optional)
  store.svelte.ts  module state       (optional)
  *.test.ts        unit tests         (co-located)
```

## Broadcast link (`src/lib/bus.ts` + `lib/db.ts`)
- GM components call `createBus().send(payload)` to put content on air.
- `BroadcastPayload` is a small discriminated union (`clear | text | image | map`). Broadcast page
  switches on `payload.kind` — decoupled from the registry.
- Every send is mirrored to IndexedDB `kv:broadcastState`, so the broadcast tab **rehydrates** on open.

## Testability (the rule: every component stands alone)
- **Logic/stores**: pure modules (`logic.ts`, `store.svelte.ts`) unit-tested with Vitest, no DOM.
- **Components**: rendered in isolation (jsdom) — a module's `Desktop`/`Editor` mounts without the
  surfaces, because it depends only on its own store + props (+ `createBus` called lazily in handlers,
  never at import). No surface, no registry, no global singletons required to test one component.
- **Surfaces**: thin shells; covered by Playwright e2e (window drag, editor tabs, GM→broadcast).
- IndexedDB is reached only through `lib/db.ts`, which is `vi.mock`-ed in unit tests.

## Data flow (summary)
```
Editor view  ──edit asset──>  module store ──persist──>  IndexedDB
Desktop view ──"on air"──> bus.send(payload) ──BroadcastChannel──> Broadcast page
                                   └──mirror──> IndexedDB (rehydrate on open)
```
