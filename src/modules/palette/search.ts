import type { ModuleId } from '../../lib/module';

/**
 * A single searchable thing surfaced by the command palette. `kind` decides
 * what Enter does: 'open' focuses/spawns a module window; 'editor' opens an
 * editor tab; 'spawn' is an explicit "spawn <module> window" action.
 */
export interface PaletteItem {
  /** stable id (module id, asset id, or synthetic) */
  id: string;
  /** primary line shown in the result row */
  label: string;
  /** secondary context line (optional) */
  detail?: string;
  /** which module this result belongs to / acts on */
  module: ModuleId;
  /** the action Enter performs */
  kind: 'open' | 'editor' | 'spawn';
}

export interface PaletteHit extends PaletteItem {
  score: number;
}

/**
 * Score one item against a lower-cased query. Higher = better.
 * 0 means no match. Pure — unit-tested, no DOM.
 *
 * Ranking, best to worst: exact label · label prefix · label word-start ·
 * label substring · detail substring.
 */
export function scoreItem(item: PaletteItem, q: string): number {
  if (!q) return 1; // empty query: everything matches equally
  const label = item.label.toLowerCase();
  const detail = item.detail?.toLowerCase() ?? '';
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  // word-start match (e.g. "thorne" matches "Captain Eli Thorne")
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (label.includes(q)) return 40;
  if (detail.includes(q)) return 20;
  return 0;
}

/**
 * Rank `sources` against `query`. Returns matching items sorted by score
 * (desc), ties broken by label A→Z. Pure — unit-tested, no DOM.
 */
export function search(query: string, sources: PaletteItem[], limit = 20): PaletteHit[] {
  const q = query.trim().toLowerCase();
  return sources
    .map((item) => ({ ...item, score: scoreItem(item, q) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}
