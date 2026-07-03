import { kvSet, kvGet } from '../../lib/db';
import { generateNpc, type Rng } from './generator';
import { spellLibrary } from './spells.svelte';
import type { NpcImport } from './import';
import type { LocalizedText } from '../../lib/loc';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';

export type Disposition = 'ally' | 'neutral' | 'hostile';

export interface EquipItem {
  id: string;
  name: LocalizedText;
  qty?: number;
  notes?: LocalizedText;
}

export interface StatRow {
  id: string;
  key: LocalizedText;
  val: LocalizedText;
}

/** A combat attack line: e.g. name "Walka" / chance "70% (35/14)" / damage "1K6+MO". */
export interface AttackRow {
  id: string;
  name: LocalizedText;
  chance?: LocalizedText;
  damage?: LocalizedText;
}

/** A skill line: e.g. name "Ukrywanie" / value "50%". */
export interface SkillRow {
  id: string;
  name: LocalizedText;
  value?: LocalizedText;
}

export interface Npc {
  id: string;
  name: LocalizedText;
  role: LocalizedText;
  disposition: Disposition;
  voice?: LocalizedText;
  /** asset id of an uploaded portrait image (see lib/db assetPut) */
  portraitId?: string;
  /** extra photo asset ids (portraitId stays the primary) */
  gallery?: string[];
  equipment?: EquipItem[];
  /** PRIVATE — never broadcast */
  gmNotes?: LocalizedText;
  /** what players may see */
  publicBlurb?: LocalizedText;
  /** system-neutral key/value rows (characteristics, HP/MP, move, DB, build…) */
  stats?: StatRow[];
  /** combat statblock — all GM-only, never broadcast */
  attacks?: AttackRow[];
  skills?: SkillRow[];
  armor?: LocalizedText;
  sanityLoss?: LocalizedText;
  /** ids into the shared spell library (see spells.svelte) — GM-only */
  spellIds?: string[];
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
  private loaded = false;

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

  // --- Attack rows ---------------------------------------------------------

  addAttack(npcId: string): AttackRow | undefined {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return undefined;
    const row: AttackRow = { id: crypto.randomUUID(), name: '' };
    if (!npc.attacks) npc.attacks = [];
    npc.attacks.push(row);
    this.persist();
    return row;
  }

  updateAttack(npcId: string, attackId: string, patch: Partial<Omit<AttackRow, 'id'>>): void {
    const row = this.list.find((n) => n.id === npcId)?.attacks?.find((a) => a.id === attackId);
    if (row) Object.assign(row, patch);
    this.persist();
  }

  removeAttack(npcId: string, attackId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (npc?.attacks) npc.attacks = npc.attacks.filter((a) => a.id !== attackId);
    this.persist();
  }

  // --- Skill rows ----------------------------------------------------------

  addSkill(npcId: string): SkillRow | undefined {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return undefined;
    const row: SkillRow = { id: crypto.randomUUID(), name: '' };
    if (!npc.skills) npc.skills = [];
    npc.skills.push(row);
    this.persist();
    return row;
  }

  updateSkill(npcId: string, skillId: string, patch: Partial<Omit<SkillRow, 'id'>>): void {
    const row = this.list.find((n) => n.id === npcId)?.skills?.find((s) => s.id === skillId);
    if (row) Object.assign(row, patch);
    this.persist();
  }

  removeSkill(npcId: string, skillId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (npc?.skills) npc.skills = npc.skills.filter((s) => s.id !== skillId);
    this.persist();
  }

  // --- Spells (references into the shared library) -------------------------

  attachSpell(npcId: string, spellId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (!npc) return;
    if (!npc.spellIds) npc.spellIds = [];
    if (!npc.spellIds.includes(spellId)) npc.spellIds.push(spellId);
    this.persist();
  }

  detachSpell(npcId: string, spellId: string): void {
    const npc = this.list.find((n) => n.id === npcId);
    if (npc?.spellIds) npc.spellIds = npc.spellIds.filter((id) => id !== spellId);
    this.persist();
  }

  // --- JSON import ---------------------------------------------------------

  /**
   * Create NPCs from parsed import shapes: mint ids for every nested row, and
   * resolve inline spells against the shared library (reusing by name). Returns
   * the created NPCs (in order).
   */
  importNpcs(inputs: NpcImport[]): Npc[] {
    const uid = () => crypto.randomUUID();
    const created: Npc[] = [];
    for (const input of inputs) {
      const npc: Npc = {
        id: uid(),
        name: input.name,
        role: input.role ?? '',
        disposition: input.disposition ?? 'neutral',
      };
      if (input.voice) npc.voice = input.voice;
      if (input.publicBlurb) npc.publicBlurb = input.publicBlurb;
      if (input.gmNotes) npc.gmNotes = input.gmNotes;
      if (input.armor) npc.armor = input.armor;
      if (input.sanityLoss) npc.sanityLoss = input.sanityLoss;
      if (input.stats?.length) npc.stats = input.stats.map((s) => ({ id: uid(), ...s }));
      if (input.attacks?.length) npc.attacks = input.attacks.map((a) => ({ id: uid(), ...a }));
      if (input.skills?.length) npc.skills = input.skills.map((s) => ({ id: uid(), ...s }));
      if (input.spells?.length) {
        npc.spellIds = spellLibrary.importMany(input.spells).map((s) => s.id);
      }
      this.list.push(npc);
      created.push(npc);
    }
    this.persist();
    return created;
  }

  persist(): void {
    void kvSet('npcs', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    // Guard against a second caller (e.g. the Stage window) re-reading kv and
    // clobbering edits the GM already made this session.
    if (this.loaded) return;
    this.loaded = true;
    const saved = await kvGet<Npc[]>('npcs');
    if (saved?.length) this.list = saved;
  }
}

export const npcs = new NpcStore();
