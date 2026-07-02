import { kvSet, kvGet } from '../../lib/db';
import { generateNpc, type Rng } from './generator';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';

export type Disposition = 'ally' | 'neutral' | 'hostile';

export interface EquipItem {
  id: string;
  name: string;
  qty?: number;
  notes?: string;
}

export interface StatRow {
  id: string;
  key: string;
  val: string;
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  disposition: Disposition;
  voice?: string;
  /** asset id of an uploaded portrait image (see lib/db assetPut) */
  portraitId?: string;
  /** extra photo asset ids (portraitId stays the primary) */
  gallery?: string[];
  equipment?: EquipItem[];
  /** PRIVATE — never broadcast */
  gmNotes?: string;
  /** what players may see */
  publicBlurb?: string;
  /** system-neutral key/value rows */
  stats?: StatRow[];
}

const SEED: Npc[] = [
  { id: 'et', name: 'Captain Eli Thorne', role: 'Harbormaster', disposition: 'ally', voice: 'gravelly, slow' },
  { id: 'mw', name: 'Mara Whitlock', role: 'Archivist', disposition: 'ally' },
  { id: 'do', name: 'Deep One Hybrid', role: 'Monster', disposition: 'hostile' },
];

/** NPC roster state. Shared by the NPC desktop widget and the NPC editor tab. */
class NpcStore {
  list = $state<Npc[]>([...SEED]);
  /** id a cross-module jump (e.g. notebook wikilink) asked the editor to focus. */
  focusId = $state<string | null>(null);

  /** Request the editor focus/scroll to an NPC (cleared once consumed). */
  focus(id: string): void {
    if (this.list.some((n) => n.id === id)) this.focusId = id;
  }

  add(name = 'New NPC'): Npc {
    const npc: Npc = { id: crypto.randomUUID(), name, role: '', disposition: 'neutral' };
    this.list.push(npc);
    this.persist();
    return npc;
  }

  /** Roll a random NPC and add it to the roster. Rng injectable for tests. */
  addGenerated(rng?: Rng): Npc {
    const g = generateNpc(rng);
    const npc: Npc = {
      id: crypto.randomUUID(),
      name: g.name,
      role: g.motivation,
      disposition: 'neutral',
      voice: `${g.trait}; ${g.mannerism}`,
    };
    this.list.push(npc);
    this.persist();
    return npc;
  }

  update(id: string, patch: Partial<Omit<Npc, 'id'>>): void {
    const npc = this.list.find((n) => n.id === id);
    if (npc) Object.assign(npc, patch);
    this.persist();
  }

  remove(id: string): void {
    const i = this.list.findIndex((n) => n.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.list[i]) as Npc;
    this.list = this.list.filter((n) => n.id !== id);
    this.persist();
    toast.undoable(t('toast.npcDeleted'), () => {
      const back = this.list.slice();
      back.splice(i, 0, removed);
      this.list = back;
      this.persist();
    });
  }

  // --- Equipment -----------------------------------------------------------

  addEquip(npcId: string, name = ''): EquipItem | undefined {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return undefined;
    const item: EquipItem = { id: crypto.randomUUID(), name };
    if (!npc.equipment) npc.equipment = [];
    npc.equipment.push(item);
    this.persist();
    return item;
  }

  updateEquip(npcId: string, equipId: string, patch: Partial<Omit<EquipItem, 'id'>>): void {
    const item = this.list.find((n) => n.id === npcId)?.equipment?.find((e) => e.id === equipId);
    if (item) Object.assign(item, patch);
    this.persist();
  }

  removeEquip(npcId: string, equipId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (npc?.equipment) npc.equipment = npc.equipment.filter((e) => e.id !== equipId);
    this.persist();
  }

  // --- Photos / gallery ----------------------------------------------------

  addPhoto(npcId: string, assetId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return;
    if (!npc.gallery) npc.gallery = [];
    if (!npc.gallery.includes(assetId)) npc.gallery.push(assetId);
    // First photo on an NPC with no portrait becomes the primary.
    if (!npc.portraitId) npc.portraitId = assetId;
    this.persist();
  }

  removePhoto(npcId: string, assetId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return;
    if (npc.gallery) npc.gallery = npc.gallery.filter((id) => id !== assetId);
    if (npc.portraitId === assetId) npc.portraitId = npc.gallery?.[0];
    this.persist();
  }

  setPrimaryPhoto(npcId: string, assetId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return;
    if (!npc.gallery) npc.gallery = [];
    if (!npc.gallery.includes(assetId)) npc.gallery.push(assetId);
    npc.portraitId = assetId;
    this.persist();
  }

  // --- Stat rows -----------------------------------------------------------

  addStat(npcId: string): StatRow | undefined {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return undefined;
    const row: StatRow = { id: crypto.randomUUID(), key: '', val: '' };
    if (!npc.stats) npc.stats = [];
    npc.stats.push(row);
    this.persist();
    return row;
  }

  updateStat(npcId: string, statId: string, patch: Partial<Omit<StatRow, 'id'>>): void {
    const row = this.list.find((n) => n.id === npcId)?.stats?.find((s) => s.id === statId);
    if (row) Object.assign(row, patch);
    this.persist();
  }

  removeStat(npcId: string, statId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (npc?.stats) npc.stats = npc.stats.filter((s) => s.id !== statId);
    this.persist();
  }

  persist(): void {
    void kvSet('npcs', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Npc[]>('npcs');
    if (saved?.length) this.list = saved;
  }
}

export const npcs = new NpcStore();
