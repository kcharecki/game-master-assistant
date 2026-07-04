import type {
  GridCell,
  GridArea,
  BroadcastPayload,
  ImageReveal,
  TextTheme,
} from '../../lib/types';
import type { PublicNpc } from '../npcs/public';

// The stage is a fixed grid the GM lays tiles onto. 12 columns is the de-facto
// layout unit (matches the broadcast aspect well); rows give vertical structure.
export const STAGE_COLS = 12;
export const STAGE_ROWS = 8;

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

export interface Scene {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tiles: Tile[];
}

/** A reusable layout: tile slots (kind + placement) with no content. */
export interface Preset {
  id: string;
  name: string;
  cols: number;
  rows: number;
  slots: { kind: TileKind; col: number; row: number; cw: number; rh: number }[];
}

function uid(): string {
  return crypto.randomUUID();
}

export function newScene(name: string): Scene {
  return { id: uid(), name, cols: STAGE_COLS, rows: STAGE_ROWS, tiles: [] };
}

/** Clamp a tile's placement so it stays fully inside the scene grid. */
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
export function firstFree(scene: Scene, cw: number, rh: number): { col: number; row: number } {
  for (let row = 1; row <= scene.rows - rh + 1; row++) {
    for (let col = 1; col <= scene.cols - cw + 1; col++) {
      const rect = { col, row, cw, rh };
      if (!scene.tiles.some((t) => overlaps(rect, t))) return { col, row };
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

export function makeTile(kind: TileKind, scene: Scene, patch: Partial<Tile> = {}): Tile {
  const { cw, rh } = defaultSpan(kind);
  const spot = firstFree(scene, cw, rh);
  return clampTile(
    { id: uid(), kind, col: spot.col, row: spot.row, cw, rh, ...patch },
    scene.cols,
    scene.rows,
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
 * Compose a scene into a broadcast grid payload, or null when nothing visible
 * resolves. Cells carry explicit placement so the broadcast mirrors the board.
 */
export function sceneToPayload(
  scene: Scene,
  npcLookup: (id: string) => PublicNpc | undefined,
): Extract<BroadcastPayload, { kind: 'grid' }> | null {
  const cells: GridCell[] = [];
  for (const tile of scene.tiles) {
    const cell = tileToCell(tile, npcLookup);
    if (cell) cells.push(cell);
  }
  if (cells.length === 0) return null;
  return { kind: 'grid', cols: scene.cols, rows: scene.rows, cells };
}

/** Derive a content-free preset from a scene's current layout. */
export function presetFromScene(scene: Scene, name: string): Preset {
  return {
    id: uid(),
    name,
    cols: scene.cols,
    rows: scene.rows,
    slots: scene.tiles.map((t) => ({ kind: t.kind, col: t.col, row: t.row, cw: t.cw, rh: t.rh })),
  };
}

/** Instantiate a preset as a fresh scene of empty, positioned tiles. */
export function sceneFromPreset(preset: Preset, name: string): Scene {
  return {
    id: uid(),
    name,
    cols: preset.cols,
    rows: preset.rows,
    tiles: preset.slots.map((s) => ({ id: uid(), ...s })),
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
