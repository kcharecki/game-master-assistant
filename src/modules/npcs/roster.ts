import type { Npc } from './store.svelte';

/**
 * Filter a roster by a free-text query, matching name, role, or disposition
 * (case-insensitive, whitespace-trimmed). Empty/blank query returns all.
 * Pure — unit-tested, no DOM.
 */
export function filterNpcs(list: Npc[], query: string): Npc[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((n) =>
    [n.name, n.role, n.disposition].some((f) => f.toLowerCase().includes(q))
  );
}
