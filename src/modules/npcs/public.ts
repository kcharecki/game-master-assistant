import type { Npc } from './store.svelte';
import { loc } from '../../lib/loc';
import type { Locale } from '../../lib/stores/lang.svelte';

/** Player-safe projection of an NPC — localized text resolved to plain strings. */
export interface PublicNpc {
  name: string;
  role: string;
  portraitId?: string;
  blurb?: string;
  stats?: { id: string; key: string; val: string }[];
}

/**
 * Strip an NPC down to only player-safe fields, resolving every localized value
 * to `lang`. Deliberately EXCLUDES gmNotes and equipment — GM-eyes-only.
 */
export function publicView(npc: Npc, lang: Locale = 'en'): PublicNpc {
  const view: PublicNpc = { name: loc(npc.name, lang), role: loc(npc.role, lang) };
  if (npc.portraitId) view.portraitId = npc.portraitId;
  if (npc.publicBlurb) view.blurb = loc(npc.publicBlurb, lang);
  if (npc.stats?.length) {
    view.stats = npc.stats.map((s) => ({ id: s.id, key: loc(s.key, lang), val: loc(s.val, lang) }));
  }
  return view;
}
