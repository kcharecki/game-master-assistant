import { kvGet, kvSet } from '../../lib/db';
import { npcs } from '../npcs/store.svelte';
import { publicView, type PublicNpc } from '../npcs/public';
import {
  newBeat,
  clampTile,
  makeTile,
  tileToCell,
  tilesToPayload,
  resolveTiles,
  templateFromBeat,
  beatFromTemplate,
  distributeAreas,
  type Beat,
  type Tile,
  type TileKind,
  type Template,
  type Variant,
  type Fork,
} from './board';
import type { BroadcastPayload } from '../../lib/types';
import { putOnAir } from '../reveal/bus-actions';
import { lang } from '../../lib/stores/lang.svelte';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';

// Fresh key for the v2 rundown model — the old `stageScenes` data is dropped.
const KV_RUNDOWN = 'stageRundown';
// Templates live under their own key so they persist across campaigns/sessions.
const KV_TEMPLATES = 'stageTemplates';

export type StageMode = 'plan' | 'run';

interface StageState {
  beats: Beat[];
  cursorId: string; // the beat being edited (PLAN) / the playhead / AIR (RUN)
}

/** What's staged/aired: a beat plus the variant chosen for it (null = base). */
export interface AirRef {
  beatId: string;
  variantId: string | null;
}

function uid(): string {
  return crypto.randomUUID();
}

/** Reactive store for the Broadcast Stage: a rundown of beats, tiles, undo, templates. */
class StageStore {
  state = $state<StageState>({ beats: [newBeat('Cold Open')], cursorId: '' });
  templates = $state<Template[]>([]);
  /** PLAN = build the rundown · RUN = live cockpit. */
  mode = $state<StageMode>('plan');
  /** Live-link: when on, every edit re-broadcasts immediately. */
  live = $state(false);
  selected = $state<string | null>(null);
  /** The variant currently being edited on the cursor beat (null = base). */
  activeVariantId = $state<string | null>(null);

  // --- RUN cockpit state ----------------------------------------------------
  /** Beat + variant staged in Preview (the "armed next"). */
  armedId = $state<string>('');
  armedVariantId = $state<string | null>(null);
  /** What's currently on air (mirrors the last TAKE), or null when clear. */
  air = $state<AirRef | null>(null);

  // Per-beat undo/redo stacks of serialized { tiles, variants } snapshots.
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  /** Injected by the Desktop component so the store can push to the broadcast. */
  onAir: ((payload: BroadcastPayload) => void) | null = null;

  constructor() {
    this.state.cursorId = this.state.beats[0].id;
    this.armedId = this.state.beats[0].id;
  }

  setMode(m: StageMode): void {
    this.mode = m;
    if (m === 'run' && !this.state.beats.some((b) => b.id === this.armedId)) {
      this.armedId = this.state.cursorId;
      this.armedVariantId = null;
    }
  }

  // --- rundown (beats) ------------------------------------------------------
  get beats(): Beat[] {
    return this.state.beats;
  }
  get cursorId(): string {
    return this.state.cursorId;
  }
  get active(): Beat {
    return this.state.beats.find((b) => b.id === this.state.cursorId) ?? this.state.beats[0];
  }
  /** Effective tiles for the cursor beat, composited through the active variant. */
  get tiles(): Tile[] {
    return resolveTiles(this.active, this.activeVariantId);
  }
  get cursorIndex(): number {
    return Math.max(0, this.state.beats.findIndex((b) => b.id === this.state.cursorId));
  }
  beatById(id: string): Beat | undefined {
    return this.state.beats.find((b) => b.id === id);
  }

  setCursor(id: string): void {
    if (this.state.beats.some((b) => b.id === id)) {
      this.state.cursorId = id;
      this.activeVariantId = null;
      this.selected = null;
      this.clearHistory();
      this.persistLive();
    }
  }

  addBeat(name?: string): Beat {
    const b = newBeat(name ?? `Beat ${this.state.beats.length + 1}`);
    this.state.beats = [...this.state.beats, b];
    this.state.cursorId = b.id;
    this.activeVariantId = null;
    this.clearHistory();
    this.persistLive();
    return b;
  }

  /** Add a beat from a template's slot layout (empty, positioned tiles). */
  addBeatFromTemplate(templateId: string): Beat | null {
    const tpl = this.templates.find((x) => x.id === templateId);
    return tpl ? this.addBeatFrom(tpl) : null;
  }

  /** Add a beat from any template object (built-in or saved). */
  addBeatFrom(tpl: Template): Beat {
    const b = beatFromTemplate(tpl, tpl.name);
    this.state.beats = [...this.state.beats, b];
    this.state.cursorId = b.id;
    this.activeVariantId = null;
    this.clearHistory();
    this.persistLive();
    return b;
  }

  duplicateBeat(id?: string): Beat {
    const src = this.state.beats.find((b) => b.id === (id ?? this.state.cursorId)) ?? this.active;
    const copy: Beat = {
      ...structuredClone($state.snapshot(src)),
      id: uid(),
      name: `${src.name} copy`,
      tiles: src.tiles.map((t) => ({ ...$state.snapshot(t), id: uid() })),
    };
    const i = this.state.beats.findIndex((b) => b.id === src.id);
    const next = this.state.beats.slice();
    next.splice(i + 1, 0, copy);
    this.state.beats = next;
    this.state.cursorId = copy.id;
    this.activeVariantId = null;
    this.clearHistory();
    this.persistLive();
    return copy;
  }

  renameBeat(id: string, name: string): void {
    const b = this.state.beats.find((x) => x.id === id);
    if (b) {
      b.name = name;
      this.persist();
    }
  }

  /** Move a beat to a new index on the spine (drag-to-reorder). */
  moveBeat(id: string, toIndex: number): void {
    const from = this.state.beats.findIndex((b) => b.id === id);
    if (from < 0) return;
    const next = this.state.beats.slice();
    const [b] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, b);
    this.state.beats = next;
    this.persistLive();
  }

  removeBeat(id: string): void {
    if (this.state.beats.length <= 1) return;
    const i = this.state.beats.findIndex((b) => b.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.state.beats[i]) as Beat;
    const prevCursor = this.state.cursorId;
    const next = this.state.beats.filter((b) => b.id !== id);
    // Clear any fork refs that pointed at the removed beat (keep the labeled fork).
    for (const b of next) {
      for (const f of b.forks) {
        if (f.targetBeatId === id) f.targetBeatId = undefined;
        if (f.rejoinBeatId === id) f.rejoinBeatId = undefined;
      }
    }
    this.state.beats = next;
    if (this.state.cursorId === id) this.state.cursorId = next[Math.min(i, next.length - 1)].id;
    if (this.armedId === id) this.armedId = this.state.cursorId;
    this.clearHistory();
    this.persistLive();
    toast.undoable(t('stage.beatDeleted'), () => {
      const back = this.state.beats.slice();
      back.splice(i, 0, removed);
      this.state.beats = back;
      this.state.cursorId = prevCursor;
      this.persistLive();
    });
  }

  /** Set a beat's default mood (aired with the beat in RUN). */
  setBeatMood(id: string, mood: string | undefined): void {
    const b = this.state.beats.find((x) => x.id === id);
    if (b) {
      b.mood = mood;
      this.persist();
    }
  }

  // --- variants (deltas over the base) -------------------------------------
  private get vActive(): Variant | null {
    if (!this.activeVariantId) return null;
    return this.active.variants.find((v) => v.id === this.activeVariantId) ?? null;
  }

  setActiveVariant(id: string | null): void {
    this.activeVariantId = id && this.active.variants.some((v) => v.id === id) ? id : null;
    this.selected = null;
    this.clearHistory();
    this.persistLive();
  }

  addVariant(name: string): Variant {
    const v: Variant = { id: uid(), name, patches: {}, removed: [], added: [] };
    this.active.variants = [...this.active.variants, v];
    this.activeVariantId = v.id;
    this.selected = null;
    this.clearHistory();
    this.persist();
    return v;
  }

  renameVariant(id: string, name: string): void {
    const v = this.active.variants.find((x) => x.id === id);
    if (v) {
      v.name = name;
      this.persist();
    }
  }

  removeVariant(id: string): void {
    this.active.variants = this.active.variants.filter((v) => v.id !== id);
    if (this.activeVariantId === id) this.activeVariantId = null;
    if (this.armedVariantId === id) this.armedVariantId = null;
    this.selected = null;
    this.clearHistory();
    this.persistLive();
  }

  // --- forks (labeled side-rails) ------------------------------------------
  addFork(beatId: string, label: string): Fork | null {
    const b = this.state.beats.find((x) => x.id === beatId);
    if (!b) return null;
    const f: Fork = { id: uid(), label };
    b.forks = [...b.forks, f];
    this.persist();
    return f;
  }

  updateFork(beatId: string, forkId: string, patch: Partial<Fork>): void {
    const b = this.state.beats.find((x) => x.id === beatId);
    const f = b?.forks.find((x) => x.id === forkId);
    if (f) {
      Object.assign(f, patch);
      this.persist();
    }
  }

  removeFork(beatId: string, forkId: string): void {
    const b = this.state.beats.find((x) => x.id === beatId);
    if (b) {
      b.forks = b.forks.filter((f) => f.id !== forkId);
      this.persist();
    }
  }

  // --- tiles (variant-aware) ------------------------------------------------
  npcLookup = (id: string): PublicNpc | undefined => {
    const npc = npcs.list.find((n) => n.id === id);
    return npc ? publicView(npc, lang.current) : undefined;
  };

  private isAdded(id: string): boolean {
    return !!this.vActive?.added.some((t) => t.id === id);
  }

  /** Route a tile patch into the base tiles or the active variant delta. */
  private applyPatch(id: string, patch: Partial<Tile>): void {
    const beat = this.active;
    const v = this.vActive;
    if (!v) {
      beat.tiles = beat.tiles.map((t) =>
        t.id === id ? clampTile({ ...t, ...patch }, beat.cols, beat.rows) : t,
      );
      return;
    }
    if (this.isAdded(id)) {
      v.added = v.added.map((t) =>
        t.id === id ? clampTile({ ...t, ...patch }, beat.cols, beat.rows) : t,
      );
      return;
    }
    // Base tile edited within a variant: record only the changed keys, but clamp
    // placement against the grid so it stays valid.
    const base = beat.tiles.find((t) => t.id === id);
    if (!base) return;
    const prev = v.patches[id] ?? {};
    const nextPatch: Partial<Tile> = { ...prev, ...patch };
    const resolved = clampTile({ ...base, ...nextPatch }, beat.cols, beat.rows);
    if ('col' in patch || 'row' in patch || 'cw' in patch || 'rh' in patch) {
      nextPatch.col = resolved.col;
      nextPatch.row = resolved.row;
      nextPatch.cw = resolved.cw;
      nextPatch.rh = resolved.rh;
    }
    v.patches = { ...v.patches, [id]: nextPatch };
  }

  addTile(kind: TileKind, patch: Partial<Tile> = {}): Tile {
    this.snapshot();
    const beat = this.active;
    const tile = makeTile(kind, { cols: beat.cols, rows: beat.rows, tiles: this.tiles }, patch);
    const v = this.vActive;
    if (v) v.added = [...v.added, tile];
    else beat.tiles = [...beat.tiles, tile];
    this.selected = tile.id;
    this.commit();
    return tile;
  }

  /** Bring a tile to the front / send to back by bumping its explicit z. */
  bringToFront(id: string): void {
    const maxZ = Math.max(0, ...this.tiles.map((t) => t.z ?? 0));
    this.patchTile(id, { z: maxZ + 1 });
  }
  sendToBack(id: string): void {
    const minZ = Math.min(0, ...this.tiles.map((t) => t.z ?? 0));
    this.patchTile(id, { z: minZ - 1 });
  }

  patchTile(id: string, patch: Partial<Tile>): void {
    this.snapshot();
    this.applyPatch(id, patch);
    this.commit();
  }

  /** Push one history entry at the start of a drag/resize gesture. */
  beginGesture(): void {
    this.snapshot();
  }

  /** Move/resize without pushing history every frame (gesture already snapshot). */
  placeTile(id: string, place: { col: number; row: number; cw: number; rh: number }): void {
    this.applyPatch(id, place);
    this.persistLive();
  }

  /** Tile all elements into an equal grid partition that fills the board. */
  distribute(): void {
    const tiles = this.tiles;
    if (tiles.length === 0) return;
    this.snapshot();
    const areas = distributeAreas(tiles.length, this.active.cols, this.active.rows);
    tiles.forEach((t, i) => this.applyPatch(t.id, areas[i]));
    this.commit();
  }

  removeTile(id: string): void {
    this.snapshot();
    const beat = this.active;
    const v = this.vActive;
    if (!v) {
      beat.tiles = beat.tiles.filter((t) => t.id !== id);
    } else if (this.isAdded(id)) {
      v.added = v.added.filter((t) => t.id !== id);
    } else {
      const rest = { ...v.patches };
      delete rest[id];
      v.patches = rest;
      if (!v.removed.includes(id)) v.removed = [...v.removed, id];
    }
    if (this.selected === id) this.selected = null;
    this.commit();
  }

  /** Clone a tile in place (nudged one cell down-right), selecting the copy. */
  duplicateTile(id: string): Tile | null {
    const src = this.tiles.find((t) => t.id === id);
    if (!src) return null;
    this.snapshot();
    const beat = this.active;
    const copy = clampTile(
      { ...$state.snapshot(src), id: uid(), col: src.col + 1, row: src.row + 1 },
      beat.cols,
      beat.rows,
    );
    const v = this.vActive;
    if (v) v.added = [...v.added, copy];
    else beat.tiles = [...beat.tiles, copy];
    this.selected = copy.id;
    this.commit();
    return copy;
  }

  toggleHidden(id: string): void {
    const t = this.tiles.find((x) => x.id === id);
    if (t) this.patchTile(id, { hidden: !t.hidden });
  }

  /** Raise a tile to render last (on top). Base-order only (skips variants). */
  raise(id: string): void {
    if (this.vActive) return;
    const i = this.active.tiles.findIndex((t) => t.id === id);
    if (i < 0 || i === this.active.tiles.length - 1) return;
    const next = this.active.tiles.slice();
    const [t] = next.splice(i, 1);
    next.push(t);
    this.active.tiles = next;
    this.persist();
  }

  // --- templates (cross-campaign) ------------------------------------------
  saveTemplate(name: string): Template {
    const tpl = templateFromBeat(this.active, name);
    this.templates = [...this.templates, tpl];
    void kvSet(KV_TEMPLATES, $state.snapshot(this.templates));
    return tpl;
  }

  removeTemplate(templateId: string): void {
    this.templates = this.templates.filter((tpl) => tpl.id !== templateId);
    void kvSet(KV_TEMPLATES, $state.snapshot(this.templates));
  }

  // --- broadcast ------------------------------------------------------------
  /** Player-safe payload for a beat + variant (base when variant is null). */
  payloadFor(beatId: string, variantId: string | null): Extract<BroadcastPayload, { kind: 'grid' }> | null {
    const b = this.beatById(beatId);
    if (!b) return null;
    return tilesToPayload(b.cols, b.rows, resolveTiles(b, variantId), this.npcLookup);
  }

  /** The cursor beat's effective board (base or active variant) as a payload. */
  get preview(): Extract<BroadcastPayload, { kind: 'grid' }> | null {
    return this.payloadFor(this.active.id, this.activeVariantId);
  }

  broadcast(): void {
    const payload = this.preview;
    if (payload && this.onAir) {
      this.onAir(payload);
      this.air = { beatId: this.active.id, variantId: this.activeVariantId };
    }
  }

  // --- RUN cockpit ----------------------------------------------------------
  /** The armed beat (staged in Preview), falling back to the cursor beat. */
  get armed(): Beat {
    return this.beatById(this.armedId) ?? this.active;
  }
  get previewArmed(): Extract<BroadcastPayload, { kind: 'grid' }> | null {
    return this.payloadFor(this.armedId, this.armedVariantId);
  }

  /** Stage a beat (+ optional variant) into Preview without airing it. */
  arm(beatId: string, variantId: string | null = null): void {
    if (!this.beatById(beatId)) return;
    this.armedId = beatId;
    this.armedVariantId = variantId;
  }

  /** Stage the beat n positions from the armed one (clamped to the rundown). */
  armRelative(delta: number): void {
    const i = this.state.beats.findIndex((b) => b.id === this.armedId);
    const next = this.state.beats[Math.max(0, Math.min(i + delta, this.state.beats.length - 1))];
    if (next) this.arm(next.id, null);
  }

  /** Cycle the armed variant: base → v1 → v2 → … → base. */
  cycleArmedVariant(): void {
    const vars = this.armed.variants;
    if (vars.length === 0) return;
    const order = [null, ...vars.map((v) => v.id)];
    const at = order.indexOf(this.armedVariantId);
    this.armedVariantId = order[(at + 1) % order.length];
  }

  /** TAKE: crossfade the staged Preview to Air, then advance the playhead. */
  take(): void {
    const payload = this.previewArmed;
    if (!payload || !this.onAir) return;
    this.onAir(payload);
    this.air = { beatId: this.armedId, variantId: this.armedVariantId };
    this.state.cursorId = this.armedId;
    // Auto-arm the next beat on the spine (if any) for the next TAKE.
    const i = this.state.beats.findIndex((b) => b.id === this.armedId);
    const nxt = this.state.beats[i + 1];
    if (nxt) {
      this.armedId = nxt.id;
      this.armedVariantId = null;
    }
    this.persist();
  }

  /**
   * Air a beat selected by 0-based index or name (case-insensitive, exact then
   * substring). Used by the command palette so it works even when the Stage
   * window isn't mounted (routes through `onAir` if set, else `putOnAir`).
   */
  airBeatByRef(ref: { index?: number; name?: string }): Beat | null {
    let beat: Beat | undefined;
    if (typeof ref.index === 'number') {
      beat = this.state.beats[ref.index];
    } else if (ref.name) {
      const q = ref.name.trim().toLowerCase();
      beat =
        this.state.beats.find((b) => b.name.toLowerCase() === q) ??
        this.state.beats.find((b) => b.name.toLowerCase().includes(q));
    }
    if (!beat) return null;
    this.setCursor(beat.id);
    const payload = this.payloadFor(beat.id, null);
    if (!payload) return null;
    if (this.onAir) this.onAir(payload);
    else putOnAir(payload);
    this.air = { beatId: beat.id, variantId: null };
    return beat;
  }

  /** Back-compat alias for the command palette (`air scene N`). */
  airSceneByRef(ref: { index?: number; name?: string }): Beat | null {
    return this.airBeatByRef(ref);
  }

  /**
   * Push a single tile fullscreen (focus), using the cinematic single-image /
   * single-text broadcast layouts. To-Air returns to the full beat layout.
   */
  spotlight(id: string): void {
    const tile = this.tiles.find((t) => t.id === id);
    if (!tile || !this.onAir) return;
    const cell = tileToCell({ ...tile, hidden: false }, this.npcLookup);
    if (!cell) return;
    if (cell.kind === 'image') {
      this.onAir({
        kind: 'image',
        ...(cell.assetId ? { assetId: cell.assetId } : {}),
        ...(cell.src ? { src: cell.src } : {}),
        ...(cell.caption ? { caption: cell.caption } : {}),
        ...(cell.reveal ? { reveal: cell.reveal } : {}),
      });
    } else if (cell.kind === 'text') {
      this.onAir({
        kind: 'text',
        title: cell.title,
        body: cell.body ?? cell.title ?? '',
        ...(cell.theme ? { theme: cell.theme } : {}),
      });
    } else {
      const full = { ...cell, area: { col: 1, row: 1, cw: this.active.cols, rh: this.active.rows } };
      this.onAir({ kind: 'grid', cols: this.active.cols, rows: this.active.rows, cells: [full] });
    }
  }

  toggleLive(): void {
    this.live = !this.live;
    this.syncLive();
  }

  /** When live, push the cursor beat — clearing the broadcast if it's empty. */
  private syncLive(): void {
    if (!this.live || !this.onAir) return;
    this.onAir(this.preview ?? { kind: 'clear' });
  }

  private persistLive(): void {
    this.persist();
    this.syncLive();
  }

  // --- undo / redo ----------------------------------------------------------
  private snapshotStr(): string {
    return JSON.stringify({
      tiles: $state.snapshot(this.active.tiles),
      variants: $state.snapshot(this.active.variants),
    });
  }
  private restore(str: string): void {
    const s = JSON.parse(str) as { tiles: Tile[]; variants: Variant[] };
    this.active.tiles = s.tiles;
    this.active.variants = s.variants;
  }
  private snapshot(): void {
    this.undoStack.push(this.snapshotStr());
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
    this.redoStack.push(this.snapshotStr());
    this.restore(prev);
    this.persistLive();
  }
  redo(): void {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(this.snapshotStr());
    this.restore(next);
    this.persistLive();
  }

  // --- persistence ----------------------------------------------------------
  persist(): void {
    void kvSet(KV_RUNDOWN, $state.snapshot(this.state));
  }

  async load(): Promise<void> {
    const saved = await kvGet<StageState>(KV_RUNDOWN);
    if (saved && Array.isArray(saved.beats) && saved.beats.length) {
      const cursorId = saved.beats.some((b) => b.id === saved.cursorId)
        ? saved.cursorId
        : saved.beats[0].id;
      this.state = { beats: saved.beats, cursorId };
      this.armedId = cursorId;
    }
    const templates = await kvGet<Template[]>(KV_TEMPLATES);
    if (Array.isArray(templates)) this.templates = templates;
  }
}

export const stage = new StageStore();
export type { Tile, TileKind, Beat, Template, Variant, Fork };
