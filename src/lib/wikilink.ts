/**
 * Resolve a notebook `[[name]]` wikilink against the lore + NPC catalogues.
 * Pure — no store access, no DOM. Lore pages win ties over NPCs (lore is the
 * primary wiki; NPCs are secondary targets). Matching is case-insensitive,
 * exact-name-first, then falls back to a substring match.
 */

export type WikiModule = 'lore' | 'npcs';

export interface WikiTarget {
  module: WikiModule;
  id: string;
}

export interface WikiCandidate {
  id: string;
  name: string;
}

/**
 * Find the module + entity id a wikilink name points at, or null when nothing
 * matches. `lorePages` and `npcs` are `{id,name}` lists. Exact (case-folded)
 * match beats substring; lore beats npc on an otherwise equal match. Pure.
 */
export function resolveWikilink(
  name: string,
  lorePages: WikiCandidate[],
  npcs: WikiCandidate[]
): WikiTarget | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;

  const exact = (list: WikiCandidate[]) => list.find((c) => c.name.trim().toLowerCase() === q);
  const partial = (list: WikiCandidate[]) => list.find((c) => c.name.toLowerCase().includes(q));

  const loreExact = exact(lorePages);
  if (loreExact) return { module: 'lore', id: loreExact.id };
  const npcExact = exact(npcs);
  if (npcExact) return { module: 'npcs', id: npcExact.id };

  const lorePart = partial(lorePages);
  if (lorePart) return { module: 'lore', id: lorePart.id };
  const npcPart = partial(npcs);
  if (npcPart) return { module: 'npcs', id: npcPart.id };

  return null;
}
