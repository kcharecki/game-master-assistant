import type { PaletteItem } from './search';
import { moduleList } from '../../lib/registry';
import { npcs } from '../npcs/store.svelte';
import { lore } from '../lore/store.svelte';
import { notebook } from '../notebook/store.svelte';
import { quests } from '../quests/store.svelte';
import { tables } from '../tables/store.svelte';
import { handouts } from '../handouts/store.svelte';
import { rulesEntries } from '../rules/data';
import { forSystem } from '../rules/logic';
import { system } from '../../lib/stores/system.svelte';

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
    out.push({ id: `npc-${n.id}`, label: n.name, detail: n.role || 'NPC', module: 'npcs', kind: 'editor' });
  }
  // Lore pages
  for (const p of lore.pages) {
    out.push({ id: `lore-${p.id}`, label: p.title, detail: 'Lore page', module: 'lore', kind: 'editor' });
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
  // Quests
  for (const q of quests.quests) {
    out.push({ id: `quest-${q.id}`, label: q.title, detail: `${q.status} quest`, module: 'quests', kind: 'open' });
  }
  // Random tables
  for (const t of tables.tables) {
    out.push({ id: `table-${t.id}`, label: t.name, detail: 'Random table', module: 'tables', kind: 'open' });
  }
  // Rulings
  for (const r of tables.rulings) {
    out.push({ id: `ruling-${r.id}`, label: r.question, detail: 'Ruling', module: 'tables', kind: 'open' });
  }
  // Handouts
  for (const h of handouts.list) {
    out.push({ id: `handout-${h.id}`, label: h.title, detail: 'Handout', module: 'handouts', kind: 'open' });
  }
  // Rules reference (filtered to the active system)
  for (const e of forSystem(rulesEntries, system.current)) {
    out.push({ id: `rule-${e.id}`, label: e.term, detail: 'Rule', module: 'rules', kind: 'open' });
  }
  // "Spawn <module> window" actions — every module that has a desktop view.
  for (const m of moduleList) {
    if (m.desktop) {
      out.push({ id: `spawn-${m.id}`, label: `Open ${m.title} window`, detail: 'Spawn window', module: m.id, kind: 'spawn' });
    }
  }

  return out;
}
