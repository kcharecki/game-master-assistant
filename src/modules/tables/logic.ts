/** Injectable RNG: returns a float in [0, 1). Defaults to Math.random. */
export type Rng = () => number;

export interface TableEntry {
  text: string;
  /** Relative weight; defaults to 1 when absent or non-positive. */
  weight?: number;
}

export interface RandomTable {
  id: string;
  name: string;
  entries: TableEntry[];
}

export interface Ruling {
  id: string;
  question: string;
  ruling: string;
  at: number;
}

function wt(e: TableEntry): number {
  return e.weight && e.weight > 0 ? e.weight : 1;
}

/**
 * Roll once on a table, honouring per-entry weights. Returns undefined for an
 * empty table. Deterministic for a given rng. Pure — no DOM, no store.
 */
export function rollOnTable(table: RandomTable, rng: Rng = Math.random): TableEntry | undefined {
  const entries = table.entries;
  if (entries.length === 0) return undefined;
  const total = entries.reduce((s, e) => s + wt(e), 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= wt(e);
    if (r < 0) return e;
  }
  return entries[entries.length - 1];
}

/** Built-in loot tables keyed by game system. */
export const LOOT_TABLES: Record<string, RandomTable> = {
  dnd: {
    id: 'loot-dnd',
    name: 'D&D Loot',
    entries: [
      { text: '2d6 × 10 gp in a coin pouch', weight: 4 },
      { text: 'A potion of healing', weight: 3 },
      { text: 'A finely made dagger (mundane)', weight: 3 },
      { text: 'A spell scroll (1st level)', weight: 2 },
      { text: 'A small gemstone worth 50 gp', weight: 2 },
      { text: 'A +1 weapon', weight: 1 },
      { text: 'A mysterious sealed map', weight: 1 },
    ],
  },
  coc: {
    id: 'loot-coc',
    name: 'CoC Findings',
    entries: [
      { text: 'A bundle of personal letters', weight: 4 },
      { text: 'A few dollars and loose change', weight: 4 },
      { text: 'A worn pocket watch', weight: 3 },
      { text: 'A page torn from an occult tome (+1% Cthulhu Mythos)', weight: 1 },
      { text: 'A loaded revolver, 5 rounds', weight: 2 },
      { text: 'A photograph of a missing person', weight: 2 },
    ],
  },
};

/** Generate one piece of loot for a system, falling back to D&D. */
export function generateLoot(system: string, rng: Rng = Math.random): string {
  const table = LOOT_TABLES[system] ?? LOOT_TABLES.dnd;
  return rollOnTable(table, rng)?.text ?? '';
}
