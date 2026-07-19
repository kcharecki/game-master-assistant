import type { PaletteItem } from './search';
import { moduleList } from '../../lib/registry';
import { npcs } from '../npcs/store.svelte';
import { lore } from '../lore/store.svelte';
import { notebook } from '../notebook/store.svelte';
import { handouts } from '../handouts/store.svelte';
import { rules } from '../rules/store.svelte';
import { forSystem } from '../rules/logic';
import { system } from '../../lib/stores/system.svelte';
import { loc } from '../../lib/loc';
import { lang } from '../../lib/stores/lang.svelte';

/**
 * Gather every searchable thing across the app's stores into one flat list.
 * Called fresh each time the palette opens so results reflect current state.
 * Reads live stores via `$state.snapshot`-free getters (plain reads are fine
 * outside reactive scope here).
 */
export function collectSources(): PaletteItem[] {
  const out: PaletteItem[] = [];

  // NPCs
  for (const n of npcs.list) {
    out.push({
      id: `npc-${n.id}`,
      label: loc(n.name, lang.current),
      detail: loc(n.role, lang.current) || 'NPC',
      module: 'npcs',
      kind: 'editor',
    });
  }
  // Lore pages
  for (const p of lore.pages) {
    out.push({ id: `lore-${p.id}`, label: loc(p.title, lang.current), detail: 'Lore page', module: 'lore', kind: 'editor' });
  }
  // Notes
  for (const note of notebook.notes) {
    out.push({
      id: `note-${note.id}`,
      label: note.body.slice(0, 60),
      detail: 'Session note',
      module: 'notebook',
      kind: 'open',
    });
  }
  // Handouts
  for (const h of handouts.list) {
    out.push({ id: `handout-${h.id}`, label: h.title, detail: 'Handout', module: 'handouts', kind: 'open' });
  }
  // Rules reference (merged seed + custom, filtered to the active system)
  for (const e of forSystem(rules.allRules, system.current)) {
    out.push({ id: `rule-${e.id}`, label: loc(e.term, lang.current), detail: 'Rule', module: 'rules', kind: 'open' });
  }
  // Rulings log (active, current system)
  for (const r of rules.systemRulings) {
    if (r.status !== 'active') continue;
    out.push({ id: `ruling-${r.id}`, label: loc(r.title, lang.current), detail: 'Ruling', module: 'rules', kind: 'open' });
  }
  // "Spawn <module> window" actions — every module that has a desktop view.
  for (const m of moduleList) {
    if (m.desktop) {
      out.push({ id: `spawn-${m.id}`, label: `Open ${m.title} window`, detail: 'Spawn window', module: m.id, kind: 'spawn' });
    }
  }

  return out;
}
