import type { GameSystem } from '../../lib/system';
import type { RuleEntry } from './data';

export type { RuleEntry } from './data';

/** Entries relevant to a system: system-specific ones plus the shared 'both'. */
export function forSystem(entries: RuleEntry[], system: GameSystem): RuleEntry[] {
  return entries.filter((e) => e.system === system || e.system === 'both');
}

/**
 * Search rules by free text over term + body (case-insensitive). Empty query
 * returns everything (already system-filtered by the caller). Term matches are
 * ranked above body-only matches; ties broken by term A→Z.
 * Pure — unit-tested, no DOM.
 */
export function searchRules(query: string, entries: RuleEntry[]): RuleEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries].sort((a, b) => a.term.localeCompare(b.term));
  return entries
    .map((e) => {
      const term = e.term.toLowerCase();
      const score = term.includes(q) ? 2 : e.body.toLowerCase().includes(q) ? 1 : 0;
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.term.localeCompare(b.e.term))
    .map((x) => x.e);
}
