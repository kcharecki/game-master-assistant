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
}

export interface Transform {
  /** pan offset in pixels */
  panX: number;
  panY: number;
  /** zoom factor, clamped 0.25..4 */
  zoom: number;
}

export const GRID_SIZE = 48; // pixels per cell at zoom 1
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

/** Default fog grid dimensions (cells). */
export const FOG_COLS = 20;
export const FOG_ROWS = 14;

/** Snap a pixel coordinate to the nearest grid cell index. */
export function snapToCell(px: number, gridSize = GRID_SIZE): number {
  return Math.round(px / gridSize);
}

/** A fresh fog grid: every cell hidden (false = not yet revealed). */
export function makeFog(cols = FOG_COLS, rows = FOG_ROWS): boolean[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

/** Serialize a boolean fog grid to the 0/1 number grid the broadcast payload carries. */
export function serializeFog(fog: boolean[][]): number[][] {
  return fog.map((row) => row.map((cell) => (cell ? 1 : 0)));
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
  /** Fog of war: true = revealed to players. */
  fog = $state<boolean[][]>(makeFog());

  /** Paint (reveal) or erase (re-hide) a single cell; ignores out-of-bounds. */
  setFog(col: number, row: number, revealed: boolean): void {
    if (row < 0 || row >= this.fog.length || col < 0 || col >= this.fog[0].length) return;
    this.fog[row][col] = revealed;
  }

  clearFog(): void {
    this.fog = makeFog(this.fog[0]?.length ?? FOG_COLS, this.fog.length || FOG_ROWS);
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

  removeToken(id: string): void {
    this.tokens = this.tokens.filter((t) => t.id !== id);
    this.persist();
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

  persist(): void {
    void kvSet('mapTokens', $state.snapshot(this.tokens));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Token[]>('mapTokens');
    if (saved?.length) this.tokens = saved;
  }
}

export const map = new MapStore();
