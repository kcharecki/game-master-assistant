import type { Npc, StatRow } from './store.svelte';

/** Player-safe projection of an NPC. Single source of truth for what may reach players. */
export interface PublicNpc {
  name: string;
  role: string;
  portraitId?: string;
  blurb?: string;
  stats?: StatRow[];
}

/**
 * Strip an NPC down to only player-safe fields.
 * Deliberately EXCLUDES gmNotes and equipment — those stay GM-eyes-only.
 */
export function publicView(npc: Npc): PublicNpc {
  const view: PublicNpc = { name: npc.name, role: npc.role };
  if (npc.portraitId) view.portraitId = npc.portraitId;
  if (npc.publicBlurb) view.blurb = npc.publicBlurb;
  if (npc.stats?.length) view.stats = npc.stats.map((s) => ({ ...s }));
  return view;
}
