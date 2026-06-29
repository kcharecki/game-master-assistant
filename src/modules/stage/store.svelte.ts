import { kvGet, kvSet } from '../../lib/db';
import { npcs } from '../npcs/store.svelte';
import { publicView, type PublicNpc } from '../npcs/public';
import {
  newScene,
  clampTile,
  makeTile,
  tileToCell,
  sceneToPayload,
  presetFromScene,
  sceneFromPreset,
  type Scene,
  type Tile,
  type TileKind,
  type Preset,
} from './board';
import type { BroadcastPayload } from '../../lib/types';

const KV_SCENES = 'stageScenes';
// Presets live under their own key so they persist across campaigns/sessions.
const KV_PRESETS = 'stagePresets';

interface StageState {
  scenes: Scene[];
  activeId: string;
}

/** Reactive store for the Broadcast Stage: scenes (tabs), tiles, undo, presets. */
class StageStore {
  state = $state<StageState>({ scenes: [newScene('Scene 1')], activeId: '' });
  presets = $state<Preset[]>([]);
  /** Live-link: when on, every edit re-broadcasts immediately. */
  live = $state(false);
  selected = $state<string | null>(null);

  // Per-scene undo/redo stacks of serialized tile arrays.
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  /** Injected by the Desktop component so the store can push to the broadcast. */
  onAir: ((payload: BroadcastPayload) => void) | null = null;

  constructor() {
    this.state.activeId = this.state.scenes[0].id;
  }

  // --- scenes (tabs) --------------------------------------------------------
  get scenes(): Scene[] {
    return this.state.scenes;
  }
  get activeId(): string {
    return this.state.activeId;
  }
  get active(): Scene {
    return this.state.scenes.find((s) => s.id === this.state.activeId) ?? this.state.scenes[0];
  }
  get tiles(): Tile[] {
    return this.active.tiles;
  }

  setActive(id: string): void {
    if (this.state.scenes.some((s) => s.id === id)) {
      this.state.activeId = id;
      this.selected = null;
      this.clearHistory();
      this.persistLive();
    }
  }

  addScene(name?: string): Scene {
    const s = newScene(name ?? `Scene ${this.state.scenes.length + 1}`);
    this.state.scenes = [...this.state.scenes, s];
    this.state.activeId = s.id;
    this.clearHistory();
    this.persistLive();
    return s;
  }

  duplicateScene(id?: string): Scene {
    const src = this.state.scenes.find((s) => s.id === (id ?? this.state.activeId)) ?? this.active;
    const copy: Scene = {
      ...structuredClone($state.snapshot(src)),
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      tiles: src.tiles.map((t) => ({ ...$state.snapshot(t), id: crypto.randomUUID() })),
    };
    const i = this.state.scenes.findIndex((s) => s.id === src.id);
    const next = this.state.scenes.slice();
    next.splice(i + 1, 0, copy);
    this.state.scenes = next;
    this.state.activeId = copy.id;
    this.clearHistory();
    this.persistLive();
    return copy;
  }

  renameScene(id: string, name: string): void {
    const s = this.state.scenes.find((x) => x.id === id);
    if (s) {
      s.name = name;
      this.persist();
    }
  }

  removeScene(id: string): void {
    if (this.state.scenes.length <= 1) return;
    const i = this.state.scenes.findIndex((s) => s.id === id);
    if (i < 0) return;
    const next = this.state.scenes.filter((s) => s.id !== id);
    this.state.scenes = next;
    if (this.state.activeId === id) this.state.activeId = next[Math.min(i, next.length - 1)].id;
    this.clearHistory();
    this.persistLive();
  }

  // --- tiles ----------------------------------------------------------------
  npcLookup = (id: string): PublicNpc | undefined => {
    const npc = npcs.list.find((n) => n.id === id);
    return npc ? publicView(npc) : undefined;
  };

  addTile(kind: TileKind, patch: Partial<Tile> = {}): Tile {
    this.snapshot();
    const tile = makeTile(kind, this.active, patch);
    this.active.tiles = [...this.active.tiles, tile];
    this.selected = tile.id;
    this.commit();
    return tile;
  }

  patchTile(id: string, patch: Partial<Tile>): void {
    this.snapshot();
    this.active.tiles = this.active.tiles.map((t) =>
      t.id === id ? clampTile({ ...t, ...patch }, this.active.cols, this.active.rows) : t,
    );
    this.commit();
  }

  /** Push one history entry at the start of a drag/resize gesture. */
  beginGesture(): void {
    this.snapshot();
  }

  /** Move/resize without clamping intermediate steps onto history every frame. */
  placeTile(id: string, place: { col: number; row: number; cw: number; rh: number }): void {
    this.active.tiles = this.active.tiles.map((t) =>
      t.id === id ? clampTile({ ...t, ...place }, this.active.cols, this.active.rows) : t,
    );
    this.persistLive();
  }

  removeTile(id: string): void {
    this.snapshot();
    this.active.tiles = this.active.tiles.filter((t) => t.id !== id);
    if (this.selected === id) this.selected = null;
    this.commit();
  }

  toggleHidden(id: string): void {
    const t = this.active.tiles.find((x) => x.id === id);
    if (t) this.patchTile(id, { hidden: !t.hidden });
  }

  /** Raise a tile to render last (on top) — used on select for z-order. */
  raise(id: string): void {
    const i = this.active.tiles.findIndex((t) => t.id === id);
    if (i < 0 || i === this.active.tiles.length - 1) return;
    const next = this.active.tiles.slice();
    const [t] = next.splice(i, 1);
    next.push(t);
    this.active.tiles = next;
    this.persist();
  }

  // --- presets (cross-campaign) --------------------------------------------
  savePreset(name: string): Preset {
    const p = presetFromScene(this.active, name);
    this.presets = [...this.presets, p];
    void kvSet(KV_PRESETS, $state.snapshot(this.presets));
    return p;
  }

  applyPreset(presetId: string): void {
    const p = this.presets.find((x) => x.id === presetId);
    if (!p) return;
    const scene = sceneFromPreset(p, p.name);
    this.state.scenes = [...this.state.scenes, scene];
    this.state.activeId = scene.id;
    this.clearHistory();
    this.persistLive();
  }

  removePreset(presetId: string): void {
    this.presets = this.presets.filter((p) => p.id !== presetId);
    void kvSet(KV_PRESETS, $state.snapshot(this.presets));
  }

  // --- broadcast ------------------------------------------------------------
  get preview(): Extract<BroadcastPayload, { kind: 'grid' }> | null {
    return sceneToPayload(this.active, this.npcLookup);
  }

  broadcast(): void {
    const payload = this.preview;
    if (payload && this.onAir) this.onAir(payload);
  }

  /**
   * Push a single tile fullscreen (focus), using the cinematic single-image /
   * single-text broadcast layouts. To-Air returns to the full scene layout.
   */
  spotlight(id: string): void {
    const tile = this.active.tiles.find((t) => t.id === id);
    if (!tile || !this.onAir) return;
    const cell = tileToCell({ ...tile, hidden: false }, this.npcLookup);
    if (!cell) return;
    if (cell.kind === 'image') {
      this.onAir({
        kind: 'image',
        ...(cell.assetId ? { assetId: cell.assetId } : {}),
        ...(cell.src ? { src: cell.src } : {}),
        ...(cell.caption ? { caption: cell.caption } : {}),
      });
    } else {
      this.onAir({ kind: 'text', title: cell.title, body: cell.body ?? cell.title ?? '' });
    }
  }

  toggleLive(): void {
    this.live = !this.live;
    this.syncLive();
  }

  /** When live, push the active scene — clearing the broadcast if it's empty. */
  private syncLive(): void {
    if (!this.live || !this.onAir) return;
    this.onAir(this.preview ?? { kind: 'clear' });
  }

  private persistLive(): void {
    this.persist();
    this.syncLive();
  }

  // --- undo / redo ----------------------------------------------------------
  private snapshot(): void {
    this.undoStack.push(JSON.stringify($state.snapshot(this.active.tiles)));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }
  private commit(): void {
    this.persistLive();
  }
  private clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  undo(): void {
    const prev = this.undoStack.pop();
    if (prev === undefined) return;
    this.redoStack.push(JSON.stringify($state.snapshot(this.active.tiles)));
    this.active.tiles = JSON.parse(prev) as Tile[];
    this.persistLive();
  }
  redo(): void {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(JSON.stringify($state.snapshot(this.active.tiles)));
    this.active.tiles = JSON.parse(next) as Tile[];
    this.persistLive();
  }

  // --- persistence ----------------------------------------------------------
  persist(): void {
    void kvSet(KV_SCENES, $state.snapshot(this.state));
  }

  async load(): Promise<void> {
    const saved = await kvGet<StageState>(KV_SCENES);
    if (saved && Array.isArray(saved.scenes) && saved.scenes.length) {
      const activeId = saved.scenes.some((s) => s.id === saved.activeId)
        ? saved.activeId
        : saved.scenes[0].id;
      this.state = { scenes: saved.scenes, activeId };
    }
    const presets = await kvGet<Preset[]>(KV_PRESETS);
    if (Array.isArray(presets)) this.presets = presets;
  }
}

export const stage = new StageStore();
export type { Tile, TileKind, Scene, Preset };
