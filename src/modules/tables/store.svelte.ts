import { kvSet, kvGet } from '../../lib/db';
import {
  rollOnTable,
  generateLoot,
  type RandomTable,
  type Ruling,
} from './logic';

export type { RandomTable, TableEntry, Ruling } from './logic';

const SEED_TABLES: RandomTable[] = [
  {
    id: 'weather',
    name: 'Coastal Weather',
    entries: [
      { text: 'Clear and cold', weight: 2 },
      { text: 'Grey drizzle', weight: 3 },
      { text: 'Thick sea fog', weight: 2 },
      { text: 'Howling storm', weight: 1 },
    ],
  },
  {
    id: 'rumor',
    name: 'Tavern Rumors',
    entries: [
      { text: 'They say the refinery never closes.' },
      { text: 'No one rows out past the reef anymore.' },
      { text: 'The old priest vanished a fortnight ago.' },
    ],
  },
];

const SEED_RULINGS: Ruling[] = [
  {
    id: 'r1',
    question: 'Can you take the Dodge action while grappled?',
    ruling: 'Yes — grappled only sets speed to 0; actions are unaffected.',
    at: Date.now() - 3_600_000,
  },
];

/** Rulings log + custom random tables + loot generator (GM-only). */
class TablesStore {
  tables = $state<RandomTable[]>(structuredClone(SEED_TABLES));
  rulings = $state<Ruling[]>(structuredClone(SEED_RULINGS));
  lastRoll = $state<string | null>(null);

  // --- random tables ---
  roll(id: string): void {
    const table = this.tables.find((t) => t.id === id);
    if (!table) return;
    const r = rollOnTable($state.snapshot(table));
    if (r) this.lastRoll = `${table.name}: ${r.text}`;
  }

  addTable(name = 'New table'): RandomTable {
    const table: RandomTable = { id: crypto.randomUUID(), name, entries: [] };
    this.tables.push(table);
    this.persist();
    return table;
  }

  addEntry(id: string, text: string): void {
    const t = this.tables.find((x) => x.id === id);
    if (t && text.trim()) t.entries.push({ text: text.trim() });
    this.persist();
  }

  removeTable(id: string): void {
    this.tables = this.tables.filter((t) => t.id !== id);
    this.persist();
  }

  // --- loot ---
  rollLoot(system: string): void {
    const key = system.startsWith('coc') ? 'coc' : 'dnd';
    this.lastRoll = `Loot: ${generateLoot(key)}`;
  }

  // --- rulings log ---
  addRuling(question: string, ruling: string): void {
    const q = question.trim();
    const r = ruling.trim();
    if (!q || !r) return;
    this.rulings.push({ id: crypto.randomUUID(), question: q, ruling: r, at: Date.now() });
    this.persist();
  }

  removeRuling(id: string): void {
    this.rulings = this.rulings.filter((r) => r.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('tablesData', {
      tables: $state.snapshot(this.tables),
      rulings: $state.snapshot(this.rulings),
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{ tables: RandomTable[]; rulings: Ruling[] }>('tablesData');
    if (saved) {
      if (saved.tables) this.tables = saved.tables;
      if (saved.rulings) this.rulings = saved.rulings;
    }
  }
}

export const tables = new TablesStore();
