import type { Npc, Disposition } from './store.svelte';
import { locStrings } from '../../lib/loc';

/** Master-list disposition filter: a specific disposition, or 'all'. */
export type DispFilter = Disposition | 'all';

/**
 * Filter a roster by a free-text query, matching name or role in EITHER language
 * plus disposition (case-insensitive, whitespace-trimmed). Empty/blank query
 * returns all. Pure — unit-tested, no DOM.
 */
export function filterNpcs(list: Npc[], query: string): Npc[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((n) =>
    [...locStrings(n.name), ...locStrings(n.role), n.disposition].some((f) =>
      f.toLowerCase().includes(q),
    ),
  );
}

/**
 * Master-list filter: free-text query composed with a disposition filter.
 * `disp === 'all'` keeps every disposition. Pure — unit-tested, no DOM.
 */
export function queryNpcs(list: Npc[], query: string, disp: DispFilter): Npc[] {
  const byText = filterNpcs(list, query);
  return disp === 'all' ? byText : byText.filter((n) => n.disposition === disp);
}

/** Count NPCs per disposition (for the filter-chip badges). */
export function dispositionCounts(list: Npc[]): Record<DispFilter, number> {
  const counts: Record<DispFilter, number> = { all: list.length, ally: 0, neutral: 0, hostile: 0 };
  for (const n of list) counts[n.disposition]++;
  return counts;
}
