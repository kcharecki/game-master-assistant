import { describe, it, expect } from 'vitest';
import { rollOnTable, generateLoot, LOOT_TABLES, type RandomTable } from './logic';

const evenly: RandomTable = {
  id: 't',
  name: 'Three',
  entries: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
};

describe('rollOnTable (unweighted)', () => {
  it('selects by proportional slice', () => {
    // total weight 3; rng 0 -> first, 0.4 -> second, 0.9 -> third
    expect(rollOnTable(evenly, () => 0)?.text).toBe('a');
    expect(rollOnTable(evenly, () => 0.4)?.text).toBe('b');
    expect(rollOnTable(evenly, () => 0.9)?.text).toBe('c');
  });
  it('returns undefined for an empty table', () => {
    expect(rollOnTable({ id: 'e', name: 'E', entries: [] })).toBeUndefined();
  });
});

const weighted: RandomTable = {
  id: 'w',
  name: 'Weighted',
  entries: [
    { text: 'common', weight: 9 },
    { text: 'rare', weight: 1 },
  ],
};

describe('rollOnTable (weighted)', () => {
  it('honours weights', () => {
    // total 10; rng 0.5 -> still inside the weight-9 slice
    expect(rollOnTable(weighted, () => 0.5)?.text).toBe('common');
    // rng 0.95 -> past 9/10, lands on rare
    expect(rollOnTable(weighted, () => 0.95)?.text).toBe('rare');
  });
  it('treats missing/zero weight as 1', () => {
    const t: RandomTable = { id: 'z', name: 'Z', entries: [{ text: 'x', weight: 0 }, { text: 'y' }] };
    expect(rollOnTable(t, () => 0.25)?.text).toBe('x');
    expect(rollOnTable(t, () => 0.75)?.text).toBe('y');
  });
});

describe('generateLoot', () => {
  it('rolls on the system table', () => {
    expect(LOOT_TABLES.dnd.entries.some((e) => e.text === generateLoot('dnd', () => 0))).toBe(true);
  });
  it('falls back to D&D for an unknown system', () => {
    expect(generateLoot('zzz', () => 0)).toBe(LOOT_TABLES.dnd.entries[0].text);
  });
});
