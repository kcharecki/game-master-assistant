import { kvSet, kvGet } from '../../lib/db';

export interface Token {
  id: string;
  /** grid-cell coordinates (not pixels) */
  gx: number;
  gy: number;
  label: string;
  color: string;
  hp: number;
  maxHp: number;
  conditions: string[];
  /** footprint in cells (1 = 1×1 Medium, 2 = 2×2 Large, 3 = 3×3 Huge). Default 1. */
  size?: number;
}

/** Grid overlay style shared with the broadcast map. */
export type GridMode = 'square' | 'hex' | 'none';

/** A named battle-map snapshot (fog + tokens + background + framing). */
export interface SavedMap {
  id: string;
  name: string;
  at: number;
  tokens: Token[];
  fog: boolean[][];
  bg: MapBg | null;
  view: { x: number; y: number; w: number; h: number } | null;
  grid: GridMode;
}

export interface Transform {
  /** pan offset in pixels */
  panX: number;
  panY: number;
  /** zoom factor, clamped 0.25..4 */
  zoom: number;
}

/** Uploaded background image. One grid cell = 1 metre, so `scale` (world-px per
 *  natural-px) is chosen at calibration time to make `GRID_SIZE` cover one metre. */
export interface MapBg {
  assetId: string;
  /** natural image dimensions, px */
  w: number;
  h: number;
  /** display world-px per natural-px (set by ruler/box calibration) */
  scale: number;
  /** image top-left offset in world px (grid-phase, set by box calibration so the
   *  printed squares land on cell boundaries). 0..GRID_SIZE. */
  dx: number;
  dy: number;
}

export const GRID_SIZE = 48; // pixels per cell at zoom 1 = 1 metre
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

/** Default fog grid dimensions (cells). */
export const FOG_COLS = 20;
export const FOG_ROWS = 14;

/** Snap a pixel coordinate to the nearest grid cell index. */
export function snapToCell(px: number, gridSize = GRID_SIZE): number {
  return Math.round(px / gridSize);
}

/** A fresh fog grid. Defaults to fully hidden; pass `revealed = true` for a
 *  fully-visible map (fog then becomes opt-in via the Hide/Region tools). */
export function makeFog(cols = FOG_COLS, rows = FOG_ROWS, revealed = false): boolean[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => revealed));
}

/** Serialize a boolean fog grid to the 0/1 number grid the broadcast payload carries. */
export function serializeFog(fog: boolean[][]): number[][] {
  return fog.map((row) => row.map((cell) => (cell ? 1 : 0)));
}

/**
 * Set every cell inside the rectangle (inclusive, any corner order) to `revealed`,
 * clamped to the grid. Mutates `fog` in place and returns it. Powers the
 * "select a portion to reveal" marquee tool.
 */
export function fillFogRect(
  fog: boolean[][],
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  revealed: boolean
): boolean[][] {
  if (!fog.length || !fog[0]?.length) return fog;
  const cLo = Math.max(0, Math.min(c0, c1));
  const cHi = Math.min(fog[0].length - 1, Math.max(c0, c1));
  const rLo = Math.max(0, Math.min(r0, r1));
  const rHi = Math.min(fog.length - 1, Math.max(r0, r1));
  for (let r = rLo; r <= rHi; r++) {
    for (let c = cLo; c <= cHi; c++) fog[r][c] = revealed;
  }
  return fog;
}

/** Grow a fog grid to at least `cols`×`rows`, preserving existing reveal state. */
export function growFog(fog: boolean[][], cols: number, rows: number): boolean[][] {
  const R = Math.max(fog.length, Math.max(1, Math.ceil(rows)));
  const C = Math.max(fog[0]?.length ?? 0, Math.max(1, Math.ceil(cols)));
  return Array.from({ length: R }, (_, r) =>
    Array.from({ length: C }, (_, c) => fog[r]?.[c] ?? false)
  );
}

/**
 * Scale factor to apply to a background so a measured ruler line of `lenPx`
 * world-px spans `meters` real metres — i.e. one grid cell (`gridSize` world-px)
 * equals one metre. Returns 1 for non-positive input.
 */
export function calibrationFactor(lenPx: number, meters: number, gridSize = GRID_SIZE): number {
  if (lenPx <= 0 || meters <= 0) return 1;
  const worldPxPerMeter = lenPx / meters;
  return gridSize / worldPxPerMeter;
}

/**
 * Two-point grid-sync calibration. Given a rectangle drawn over the printed map
 * (world px) that the GM says is `cols`×`rows` squares (metres), return the new
 * background `scale` and grid-phase offset (`dx`,`dy`, in 0..gridSize) so the
 * printed squares land exactly on the reveal/fog cell boundaries.
 */
export function boxCalibration(
  box: { x1: number; y1: number; x2: number; y2: number },
  cols: number,
  rows: number,
  prev: { scale: number; dx: number; dy: number },
  gridSize = GRID_SIZE
): { scale: number; dx: number; dy: number } {
  const { scale: s0, dx: dx0, dy: dy0 } = prev;
  if (s0 <= 0 || cols <= 0 || rows <= 0) return prev;
  // box corners -> natural image px
  const nx1 = (box.x1 - dx0) / s0;
  const ny1 = (box.y1 - dy0) / s0;
  const nx2 = (box.x2 - dx0) / s0;
  const ny2 = (box.y2 - dy0) / s0;
  const bw = Math.abs(nx2 - nx1);
  const bh = Math.abs(ny2 - ny1);
  if (bw <= 0 || bh <= 0) return prev;
  // uniform (square) cells: average the per-axis scale so a slightly off drag
  // still yields square metres.
  const scale = ((cols * gridSize) / bw + (rows * gridSize) / bh) / 2;
  const nlx = Math.min(nx1, nx2);
  const nly = Math.min(ny1, ny2);
  // place the box's top-left on a cell boundary; normalise offset to [0,gridSize).
  const norm = (v: number) => ((v % gridSize) + gridSize) % gridSize;
  return { scale, dx: norm(-nlx * scale), dy: norm(-nly * scale) };
}

/**
 * Normalize a pointer position within an element's bounds to 0..1 coords,
 * clamped, so a ping lands at the same relative spot on the broadcast view
 * regardless of each surface's pixel size.
 */
export function normPing(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x: clamp(rect.width ? (clientX - rect.left) / rect.width : 0),
    y: clamp(rect.height ? (clientY - rect.top) / rect.height : 0),
  };
}

/** Clamp a zoom value into the allowed range. */
export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

const TOKEN_COLORS = ['#5fbf8f', '#c05b5b', '#c7a44e', '#6f9bd1'];

/** Battle map state: a token grid + pan/zoom transform. */
class MapStore {
  tokens = $state<Token[]>([
    { id: 'pc1', gx: 3, gy: 3, label: 'PC', color: '#5fbf8f', hp: 24, maxHp: 24, conditions: [] },
    {
      id: 'foe1',
      gx: 6,
      gy: 4,
      label: 'Foe',
      color: '#c05b5b',
      hp: 11,
      maxHp: 11,
      conditions: ['prone'],
    },
  ]);
  transform = $state<Transform>({ panX: 0, panY: 0, zoom: 1 });
  /** Fog of war: true = revealed to players. A new map starts fully visible;
   *  the GM adds fog with the Hide/Region tools. */
  fog = $state<boolean[][]>(makeFog(FOG_COLS, FOG_ROWS, true));
  /** Uploaded background image (1 cell = 1 metre after calibration), or null. */
  bg = $state<MapBg | null>(null);
  /** Broadcast frame in world px: the fragment shown on air (fills the player
   *  window, ratio kept). null = auto (whole background, else the fog grid). */
  view = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  /** Grid overlay style (square / hex / gridless), mirrored to the broadcast. */
  gridMode = $state<GridMode>('square');

  /** Set the grid overlay style and persist it. */
  setGridMode(mode: GridMode): void {
    this.gridMode = mode;
    void kvSet('mapGrid', mode);
  }

  /** Cycle square → hex → none → square. */
  cycleGridMode(): void {
    const order: GridMode[] = ['square', 'hex', 'none'];
    this.setGridMode(order[(order.indexOf(this.gridMode) + 1) % order.length]);
  }

  /** Set a token's footprint in cells (1..4). */
  setTokenSize(id: string, size: number): void {
    const t = this.tokens.find((x) => x.id === id);
    if (!t) return;
    t.size = Math.max(1, Math.min(4, Math.round(size)));
    this.persist();
  }

  /** Paint (reveal) or erase (re-hide) a single cell; ignores out-of-bounds. */
  setFog(col: number, row: number, revealed: boolean): void {
    if (row < 0 || row >= this.fog.length || col < 0 || col >= this.fog[0].length) return;
    this.fog[row][col] = revealed;
  }

  /** Reveal/hide every cell in a rectangle (marquee select). Persists. */
  setFogRect(c0: number, r0: number, c1: number, r1: number, revealed: boolean): void {
    fillFogRect(this.fog, c0, r0, c1, r1, revealed);
    this.persistFog();
  }

  /** Re-fog everything (hide all). */
  clearFog(): void {
    this.fog = makeFog(this.fog[0]?.length ?? FOG_COLS, this.fog.length || FOG_ROWS);
    this.persistFog();
  }

  /** Reveal everything (clear all fog). */
  revealAll(): void {
    this.fog = makeFog(this.fog[0]?.length ?? FOG_COLS, this.fog.length || FOG_ROWS, true);
    this.persistFog();
  }

  /** Background extent in grid cells (= metres), accounting for the offset. */
  bgCells(): { cols: number; rows: number } {
    if (!this.bg) return { cols: 0, rows: 0 };
    return {
      cols: Math.ceil((this.bg.dx + this.bg.w * this.bg.scale) / GRID_SIZE),
      rows: Math.ceil((this.bg.dy + this.bg.h * this.bg.scale) / GRID_SIZE),
    };
  }

  /** Grow the fog grid so it covers the whole background (preserving reveal state). */
  private coverBg(): void {
    const { cols, rows } = this.bgCells();
    if (cols && rows) this.fog = growFog(this.fog, cols, rows);
  }

  /** Set (replace) the background image. An uploaded map is revealed by default
   *  so it actually shows on air; the GM re-fogs with Hide/Region. */
  setBg(assetId: string, w: number, h: number, scale = 1): void {
    this.bg = { assetId, w, h, scale, dx: 0, dy: 0 };
    this.coverBg();
    if (this.fog[0]?.length) {
      fillFogRect(this.fog, 0, 0, this.fog[0].length - 1, this.fog.length - 1, true);
    }
    this.persistBg();
    this.persistFog();
  }

  clearBg(): void {
    this.bg = null;
    this.persistBg();
  }

  /** Set the broadcast frame (world px). Normalises corner order. */
  setView(x1: number, y1: number, x2: number, y2: number): void {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 4 || h < 4) return; // ignore stray clicks
    this.view = { x, y, w, h };
    void kvSet('mapView', $state.snapshot(this.view));
  }

  /** Reset to auto-framing (whole map). */
  clearView(): void {
    this.view = null;
    void kvSet('mapView', null);
  }

  /** The frame to broadcast: explicit view, else the background bounds, else the
   *  fog grid. Keeps the on-air map sized to real content (not an oversized grid). */
  broadcastView(): { x: number; y: number; w: number; h: number } {
    // Return a plain copy — the raw $state proxy can't be structured-cloned
    // across the BroadcastChannel / into IndexedDB.
    if (this.view) {
      return { x: this.view.x, y: this.view.y, w: this.view.w, h: this.view.h };
    }
    if (this.bg) {
      return { x: this.bg.dx, y: this.bg.dy, w: this.bg.w * this.bg.scale, h: this.bg.h * this.bg.scale };
    }
    return { x: 0, y: 0, w: (this.fog[0]?.length ?? 0) * GRID_SIZE, h: this.fog.length * GRID_SIZE };
  }

  /**
   * Calibrate the background scale from a ruler line of `lenPx` world-px that the
   * GM says is `meters` metres long, so one cell becomes one metre.
   */
  calibrate(lenPx: number, meters: number): void {
    if (!this.bg) return;
    this.bg.scale *= calibrationFactor(lenPx, meters);
    this.coverBg();
    this.persistBg();
    this.persistFog();
  }

  /**
   * Grid-sync the background from a box drawn over `cols`×`rows` printed squares,
   * setting scale + offset so the printed grid aligns to the reveal cells.
   */
  calibrateBox(
    box: { x1: number; y1: number; x2: number; y2: number },
    cols: number,
    rows: number
  ): void {
    if (!this.bg) return;
    const { scale, dx, dy } = boxCalibration(box, cols, rows, this.bg);
    this.bg.scale = scale;
    this.bg.dx = dx;
    this.bg.dy = dy;
    this.coverBg();
    this.persistBg();
    this.persistFog();
  }

  /** Snapshot for the broadcast payload (0/1 grid). */
  fogPayload(): number[][] {
    return serializeFog($state.snapshot(this.fog));
  }

  addToken(gx = 0, gy = 0, label = 'New'): Token {
    const t: Token = {
      id: crypto.randomUUID(),
      gx,
      gy,
      label,
      color: TOKEN_COLORS[this.tokens.length % TOKEN_COLORS.length],
      hp: 10,
      maxHp: 10,
      conditions: [],
    };
    this.tokens.push(t);
    this.persist();
    return t;
  }

  moveToken(id: string, gx: number, gy: number): void {
    const t = this.tokens.find((x) => x.id === id);
    if (t) {
      t.gx = gx;
      t.gy = gy;
      this.persist();
    }
  }

  /**
   * Live drag move: update a token's cell in memory only (no IndexedDB write),
   * skipping when the snapped cell hasn't changed. The caller persists once on
   * drop via `persist()`, so a drag no longer floods the DB every pointermove.
   */
  setTokenPos(id: string, gx: number, gy: number): void {
    const t = this.tokens.find((x) => x.id === id);
    if (t && (t.gx !== gx || t.gy !== gy)) {
      t.gx = gx;
      t.gy = gy;
    }
  }

  removeToken(id: string): void {
    this.tokens = this.tokens.filter((t) => t.id !== id);
    this.persist();
  }

  /** Rename a token. */
  setLabel(id: string, label: string): void {
    const t = this.tokens.find((x) => x.id === id);
    if (t) {
      t.label = label;
      this.persist();
    }
  }

  setHp(id: string, hp: number): void {
    const t = this.tokens.find((x) => x.id === id);
    if (t) {
      t.hp = Math.max(0, Math.min(t.maxHp, hp));
      this.persist();
    }
  }

  toggleCondition(id: string, cond: string): void {
    const t = this.tokens.find((x) => x.id === id);
    if (!t) return;
    t.conditions = t.conditions.includes(cond)
      ? t.conditions.filter((c) => c !== cond)
      : [...t.conditions, cond];
    this.persist();
  }

  pan(dx: number, dy: number): void {
    this.transform.panX += dx;
    this.transform.panY += dy;
  }

  zoomBy(factor: number): void {
    this.transform.zoom = clampZoom(this.transform.zoom * factor);
  }

  // ---- map library (save/switch whole battle maps) --------------------------

  /** List saved maps (metadata + payload), newest first. */
  async listMaps(): Promise<SavedMap[]> {
    const lib = (await kvGet<SavedMap[]>('mapLibrary')) ?? [];
    return [...lib].sort((a, b) => b.at - a.at);
  }

  /** Save the current battle map (fog + tokens + bg + framing) under a name. */
  async saveMap(name: string): Promise<void> {
    const lib = (await kvGet<SavedMap[]>('mapLibrary')) ?? [];
    lib.push({
      id: crypto.randomUUID(),
      name: name.trim() || `Map ${lib.length + 1}`,
      at: Date.now(),
      tokens: $state.snapshot(this.tokens),
      fog: $state.snapshot(this.fog),
      bg: this.bg ? $state.snapshot(this.bg) : null,
      view: this.view ? { ...this.view } : null,
      grid: this.gridMode,
    });
    await kvSet('mapLibrary', lib);
  }

  /** Load a saved map into the live state (does not auto-broadcast). */
  async loadMap(id: string): Promise<void> {
    const lib = (await kvGet<SavedMap[]>('mapLibrary')) ?? [];
    const m = lib.find((x) => x.id === id);
    if (!m) return;
    this.tokens = m.tokens;
    this.fog = m.fog;
    this.bg = m.bg;
    this.view = m.view;
    this.gridMode = m.grid ?? 'square';
    this.persist();
    this.persistFog();
    this.persistBg();
    void kvSet('mapView', this.view);
    void kvSet('mapGrid', this.gridMode);
  }

  /** Delete a saved map from the library. */
  async deleteMap(id: string): Promise<void> {
    const lib = (await kvGet<SavedMap[]>('mapLibrary')) ?? [];
    await kvSet('mapLibrary', lib.filter((x) => x.id !== id));
  }

  persist(): void {
    void kvSet('mapTokens', $state.snapshot(this.tokens));
  }

  persistFog(): void {
    void kvSet('mapFog', $state.snapshot(this.fog));
  }

  persistBg(): void {
    void kvSet('mapBg', this.bg ? $state.snapshot(this.bg) : null);
  }

  async load(): Promise<void> {
    const saved = await kvGet<Token[]>('mapTokens');
    if (saved?.length) this.tokens = saved;
    const fog = await kvGet<boolean[][]>('mapFog');
    if (fog?.length) this.fog = fog;
    const view = await kvGet<{ x: number; y: number; w: number; h: number } | null>('mapView');
    if (view) this.view = view;
    const grid = await kvGet<GridMode>('mapGrid');
    if (grid === 'square' || grid === 'hex' || grid === 'none') this.gridMode = grid;
    const bg = await kvGet<MapBg | null>('mapBg');
    if (bg) {
      this.bg = { ...bg, dx: bg.dx ?? 0, dy: bg.dy ?? 0 };
      // Ensure the (possibly older/smaller) saved fog grid still spans the whole
      // background, otherwise the broadcast viewBox crops/squishes the image.
      const before = this.fog.length * (this.fog[0]?.length ?? 0);
      this.coverBg();
      if (this.fog.length * (this.fog[0]?.length ?? 0) !== before) this.persistFog();
    }
  }
}

export const map = new MapStore();
