import type {
  GridCell,
  GridArea,
  BroadcastPayload,
  ImageReveal,
  TextTheme,
} from '../../lib/types';
import type { PublicNpc } from '../npcs/public';

// The stage is a fixed grid the GM lays tiles onto. 24 columns is the de-facto
// layout unit (matches the broadcast aspect well); rows give vertical structure.
export const STAGE_COLS = 24;
export const STAGE_ROWS = 16;

// image/text/npc are content sources; clock/date are computed/snapshot tiles.
// All project to player-safe grid cells.
export type TileKind = 'image' | 'text' | 'npc' | 'clock' | 'date';

/** One placed element on the stage. Placement is 1-based, CSS-grid semantics. */
export interface Tile {
  id: string;
  kind: TileKind;
  col: number; // start column (1..cols)
  row: number; // start row (1..rows)
  cw: number; // column span
  rh: number; // row span
  hidden?: boolean; // staged but withheld from the broadcast
  z?: number; // explicit stacking order (higher = front); undefined keeps source order
  // image content:
  assetId?: string;
  src?: string;
  caption?: string;
  reveal?: ImageReveal; // progressive image reveal (blur / pan)
  // text content:
  title?: string;
  body?: string;
  theme?: TextTheme; // parchment/letter/telegram skin
  // npc content:
  npcId?: string;
  // clock content:
  seconds?: number; // countdown duration
  // date content (in-world date snapshot pulled from the calendar store):
  date?: string;
  // in-world time-of-day snapshot pulled from the Timeline (schedule) store:
  time?: string;
  moon?: string;
}

/**
 * Format a countdown as m:ss (or h:mm:ss past an hour), clamped at zero. Pure —
 * the broadcast tab uses it to render the live tick.
 */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * A Variant is a lightweight alternate of a beat, stored as a *delta* over the
 * base: tiles patched by id, tiles removed, tiles added. Editing the base once
 * means every variant inherits the unchanged tiles (Phase 2 authoring).
 */
export interface Variant {
  id: string;
  name: string;
  patches: Record<string, Partial<Tile>>; // by base tile id
  removed: string[]; // base tile ids dropped in this variant
  added: Tile[]; // tiles that only exist in this variant
}

/**
 * A Fork is a labeled side-rail hung off a beat ("if they open the cabinet →").
 * `targetBeatId` is the rail's first beat; `rejoinBeatId` is where the spine
 * resumes after the rail plays out. Un-taken forks never render on air.
 */
export interface Fork {
  id: string;
  label: string;
  targetBeatId?: string;
  rejoinBeatId?: string;
}

/**
 * A Beat is one planned board state — a full stage of tiles — sitting at a
 * position on the rundown. It carries its own variants (deltas) and forks
 * (side-rails), plus an optional default mood aired with the beat.
 */
export interface Beat {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tiles: Tile[]; // the base variant
  variants: Variant[];
  forks: Fork[];
  mood?: string; // default mood id, aired with the beat
  templateId?: string; // template this beat was created from
}

/** Anything with a grid + tiles: beats and, structurally, resolved variants. */
export type Board = Pick<Beat, 'cols' | 'rows' | 'tiles'>;

/** One typed, positioned slot in a template (kind + placement, no content). */
export interface Slot {
  kind: TileKind;
  col: number;
  row: number;
  cw: number;
  rh: number;
}

/** A reusable, content-free beat layout: typed slots with placement, no assets. */
export interface Template {
  id: string;
  name: string;
  cols: number;
  rows: number;
  slots: Slot[];
}

/**
 * Built-in beat layouts offered in the library. `nameKey` is an i18n key so the
 * UI localizes the label; the component materializes one into a `Template`
 * (with a resolved name) before creating a beat.
 */
export interface BuiltinTemplate {
  id: string;
  nameKey: string;
  slots: Slot[];
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: 'bt-handout', nameKey: 'stage.tplHandout', slots: [{ kind: 'text', col: 5, row: 3, cw: 16, rh: 10 }] },
  {
    id: 'bt-portrait-letter',
    nameKey: 'stage.tplPortraitLetter',
    slots: [
      { kind: 'npc', col: 1, row: 1, cw: 10, rh: 16 },
      { kind: 'text', col: 11, row: 3, cw: 12, rh: 10 },
    ],
  },
  { id: 'bt-location', nameKey: 'stage.tplLocation', slots: [{ kind: 'image', col: 1, row: 1, cw: 24, rh: 16 }] },
  { id: 'bt-countdown', nameKey: 'stage.tplCountdown', slots: [{ kind: 'clock', col: 7, row: 5, cw: 10, rh: 6 }] },
  {
    id: 'bt-maptable',
    nameKey: 'stage.tplMapTable',
    slots: [
      { kind: 'image', col: 1, row: 1, cw: 18, rh: 16 },
      { kind: 'date', col: 19, row: 1, cw: 6, rh: 4 },
    ],
  },
  { id: 'bt-date', nameKey: 'stage.tplDate', slots: [{ kind: 'date', col: 7, row: 5, cw: 10, rh: 4 }] },
];

function uid(): string {
  return crypto.randomUUID();
}

export function newBeat(name: string): Beat {
  return {
    id: uid(),
    name,
    cols: STAGE_COLS,
    rows: STAGE_ROWS,
    tiles: [],
    variants: [],
    forks: [],
  };
}

/**
 * Resolve a beat's effective tiles for a given variant id. With no variant (or
 * an unknown id) the base tiles are returned unchanged. A variant applies, in
 * order: patches over matching base tiles, removals, then its own added tiles.
 */
export function resolveTiles(beat: Beat, variantId?: string | null): Tile[] {
  if (!variantId) return beat.tiles;
  const v = beat.variants.find((x) => x.id === variantId);
  if (!v) return beat.tiles;
  const kept = beat.tiles
    .filter((t) => !v.removed.includes(t.id))
    .map((t) => (v.patches[t.id] ? { ...t, ...v.patches[t.id] } : t));
  return [...kept, ...v.added];
}

/** Clamp a tile's placement so it stays fully inside the board grid. */
export function clampTile(tile: Tile, cols: number, rows: number): Tile {
  const cw = Math.max(1, Math.min(tile.cw, cols));
  const rh = Math.max(1, Math.min(tile.rh, rows));
  const col = Math.max(1, Math.min(tile.col, cols - cw + 1));
  const row = Math.max(1, Math.min(tile.row, rows - rh + 1));
  return { ...tile, col, row, cw, rh };
}

/** True when two tile rectangles overlap (used to find a free drop spot). */
function overlaps(a: { col: number; row: number; cw: number; rh: number }, b: Tile): boolean {
  return (
    a.col < b.col + b.cw && a.col + a.cw > b.col && a.row < b.row + b.rh && a.row + a.rh > b.row
  );
}

/**
 * First free top-left cell that fits a `cw`×`rh` rectangle without overlapping
 * existing tiles, scanning row-major. Falls back to (1,1) when the grid is full.
 */
export function firstFree(board: Board, cw: number, rh: number): { col: number; row: number } {
  for (let row = 1; row <= board.rows - rh + 1; row++) {
    for (let col = 1; col <= board.cols - cw + 1; col++) {
      const rect = { col, row, cw, rh };
      if (!board.tiles.some((t) => overlaps(rect, t))) return { col, row };
    }
  }
  return { col: 1, row: 1 };
}

/** Default span for a new tile of a given kind. */
function defaultSpan(kind: TileKind): { cw: number; rh: number } {
  if (kind === 'text') return { cw: 6, rh: 2 };
  if (kind === 'clock' || kind === 'date') return { cw: 4, rh: 2 };
  return { cw: 6, rh: 4 };
}

export function makeTile(kind: TileKind, board: Board, patch: Partial<Tile> = {}): Tile {
  const { cw, rh } = defaultSpan(kind);
  const spot = firstFree(board, cw, rh);
  return clampTile(
    { id: uid(), kind, col: spot.col, row: spot.row, cw, rh, ...patch },
    board.cols,
    board.rows,
  );
}

/**
 * Player-safe projection of one tile to a broadcast grid cell, carrying its
 * placement as a `GridArea`. NPC tiles read only the public projection (never
 * gmNotes/equipment). Returns null for hidden tiles or empty/unresolved content.
 */
export function tileToCell(
  tile: Tile,
  npcLookup: (id: string) => PublicNpc | undefined,
): GridCell | null {
  if (tile.hidden) return null;
  const area: GridArea = { col: tile.col, row: tile.row, cw: tile.cw, rh: tile.rh };
  const z = tile.z;

  if (tile.kind === 'npc') {
    if (!tile.npcId) return null;
    const pub = npcLookup(tile.npcId);
    if (!pub) return null;
    if (pub.portraitId) {
      const caption = pub.role ? `${pub.name} — ${pub.role}` : pub.name;
      return { kind: 'image', assetId: pub.portraitId, caption, area, z };
    }
    const body = [pub.role, pub.blurb].filter(Boolean).join(' — ');
    return { kind: 'text', title: pub.name, body, area, z };
  }
  if (tile.kind === 'image') {
    if (!tile.assetId && !tile.src) return null;
    const cell: GridCell = { kind: 'image', area };
    if (tile.assetId) cell.assetId = tile.assetId;
    if (tile.src) cell.src = tile.src;
    if (tile.caption) cell.caption = tile.caption;
    if (tile.reveal) cell.reveal = tile.reveal;
    if (z !== undefined) cell.z = z;
    return cell;
  }
  if (tile.kind === 'clock') {
    const cell: GridCell = { kind: 'clock', seconds: Math.max(0, tile.seconds ?? 60), area };
    if (tile.title) cell.label = tile.title;
    if (z !== undefined) cell.z = z;
    return cell;
  }
  if (tile.kind === 'date') {
    if (!tile.date) return null;
    const cell: GridCell = { kind: 'date', date: tile.date, area };
    if (tile.time) cell.time = tile.time;
    if (tile.moon) cell.moon = tile.moon;
    if (tile.title) cell.label = tile.title;
    if (z !== undefined) cell.z = z;
    return cell;
  }
  // text
  if (!tile.title && !tile.body) return null;
  const cell: GridCell = { kind: 'text', area };
  if (tile.title) cell.title = tile.title;
  if (tile.body) cell.body = tile.body;
  if (tile.theme) cell.theme = tile.theme;
  if (z !== undefined) cell.z = z;
  return cell;
}

/**
 * Compose a set of tiles into a broadcast grid payload, or null when nothing
 * visible resolves. Cells carry explicit placement so the broadcast mirrors the
 * board. Pass a beat's resolved tiles (base or variant) plus its grid size.
 */
export function tilesToPayload(
  cols: number,
  rows: number,
  tiles: Tile[],
  npcLookup: (id: string) => PublicNpc | undefined,
): Extract<BroadcastPayload, { kind: 'grid' }> | null {
  const cells: GridCell[] = [];
  for (const tile of tiles) {
    const cell = tileToCell(tile, npcLookup);
    if (cell) cells.push(cell);
  }
  if (cells.length === 0) return null;
  return { kind: 'grid', cols, rows, cells };
}

/** Derive a content-free template from a beat's current layout. */
export function templateFromBeat(beat: Beat, name: string): Template {
  return {
    id: uid(),
    name,
    cols: beat.cols,
    rows: beat.rows,
    slots: beat.tiles.map((t) => ({ kind: t.kind, col: t.col, row: t.row, cw: t.cw, rh: t.rh })),
  };
}

/** Instantiate a template as a fresh beat of empty, positioned tiles. */
export function beatFromTemplate(template: Template, name: string): Beat {
  return {
    id: uid(),
    name,
    cols: template.cols,
    rows: template.rows,
    tiles: template.slots.map((s) => ({ id: uid(), ...s })),
    variants: [],
    forks: [],
    templateId: template.id,
  };
}

/**
 * Even "tile" layout: split the board into `count` equal grid areas that fill
 * it edge-to-edge with no gaps or overlaps. Uses a near-square ncols×nrows grid;
 * a short final row stretches its tiles across the full width. Pure — the caller
 * maps areas onto tiles in order. Returns [] for count ≤ 0.
 */
export function distributeAreas(
  count: number,
  cols = STAGE_COLS,
  rows = STAGE_ROWS,
): GridArea[] {
  if (count <= 0) return [];
  const ncols = Math.ceil(Math.sqrt(count));
  const nrows = Math.ceil(count / ncols);
  const areas: GridArea[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / ncols);
    const rowStart = r * ncols;
    const inRow = Math.min(ncols, count - rowStart);
    const c = i - rowStart;
    const col = 1 + Math.round((c * cols) / inRow);
    const colEnd = 1 + Math.round(((c + 1) * cols) / inRow);
    const row = 1 + Math.round((r * rows) / nrows);
    const rowEnd = 1 + Math.round(((r + 1) * rows) / nrows);
    areas.push({
      col,
      row,
      cw: Math.max(1, colEnd - col),
      rh: Math.max(1, rowEnd - row),
    });
  }
  return areas;
}
