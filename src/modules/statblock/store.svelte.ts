import { kvSet, kvGet } from '../../lib/db';
import { evaluateEncounter, type EncounterReadout } from './cr';

export interface StatBlock {
  id: string;
  name: string;
  cr: string;
  hp: number;
  ac: number;
  type: string;
}

const SEED: StatBlock[] = [
  { id: 'goblin', name: 'Goblin', cr: '1/4', hp: 7, ac: 15, type: 'humanoid' },
  { id: 'wolf', name: 'Wolf', cr: '1/4', hp: 11, ac: 13, type: 'beast' },
  { id: 'orc', name: 'Orc', cr: '1/2', hp: 15, ac: 13, type: 'humanoid' },
  { id: 'bugbear', name: 'Bugbear', cr: '1', hp: 27, ac: 16, type: 'humanoid' },
  { id: 'ogre', name: 'Ogre', cr: '2', hp: 59, ac: 11, type: 'giant' },
  { id: 'owlbear', name: 'Owlbear', cr: '3', hp: 59, ac: 13, type: 'monstrosity' },
  { id: 'troll', name: 'Troll', cr: '5', hp: 84, ac: 15, type: 'giant' },
  { id: 'youngdragon', name: 'Young Red Dragon', cr: '10', hp: 178, ac: 18, type: 'dragon' },
];

/** Filter the library by name or type (case-insensitive). */
export function searchStatBlocks(list: StatBlock[], query: string): StatBlock[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((s) => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
}

/** Monster library + an encounter being assembled, with a live difficulty readout. */
class StatBlockStore {
  library = $state<StatBlock[]>([...SEED]);
  /** stat-block ids dropped into the current fight (duplicates allowed) */
  encounter = $state<string[]>([]);
  partySize = $state(4);
  partyLevel = $state(3);

  /** Resolve encounter ids to their stat blocks (skips removed library entries). */
  get fight(): StatBlock[] {
    return this.encounter
      .map((id) => this.library.find((s) => s.id === id))
      .filter((s): s is StatBlock => !!s);
  }

  get readout(): EncounterReadout {
    return evaluateEncounter(
      this.fight.map((s) => s.cr),
      this.partySize,
      this.partyLevel
    );
  }

  addToLibrary(s: Omit<StatBlock, 'id'>): StatBlock {
    const block: StatBlock = { ...s, id: crypto.randomUUID() };
    this.library.push(block);
    this.persist();
    return block;
  }

  addToEncounter(id: string): void {
    this.encounter.push(id);
    this.persist();
  }

  removeFromEncounter(index: number): void {
    this.encounter.splice(index, 1);
    this.persist();
  }

  clearEncounter(): void {
    this.encounter = [];
    this.persist();
  }

  setParty(size: number, level: number): void {
    this.partySize = Math.max(1, Math.round(size));
    this.partyLevel = Math.max(1, Math.round(level));
    this.persist();
  }

  persist(): void {
    void kvSet('statblock', {
      library: $state.snapshot(this.library),
      encounter: $state.snapshot(this.encounter),
      partySize: this.partySize,
      partyLevel: this.partyLevel,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{
      library: StatBlock[];
      encounter: string[];
      partySize: number;
      partyLevel: number;
    }>('statblock');
    if (saved?.library?.length) {
      this.library = saved.library;
      this.encounter = saved.encounter ?? [];
      this.partySize = saved.partySize ?? 4;
      this.partyLevel = saved.partyLevel ?? 3;
    }
  }
}

export const statblock = new StatBlockStore();
