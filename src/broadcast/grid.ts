import type { GridCell } from '../lib/types';

/** Clamp a requested column count to a sane, renderable range (1..6). */
export function clampCols(cols: number, cellCount = 0): number {
  const n = Number.isFinite(cols) ? Math.floor(cols) : 1;
  const max = Math.max(1, Math.min(6, cellCount || 6));
  return Math.min(Math.max(n, 1), max);
}

/** Asset ids referenced by a grid's image cells (for URL resolution/revocation). */
export function gridAssetIds(cells: GridCell[]): string[] {
  const ids: string[] = [];
  for (const c of cells) {
    if (c.kind === 'image' && c.assetId && !ids.includes(c.assetId)) ids.push(c.assetId);
  }
  return ids;
}
