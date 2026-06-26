import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { statblock, searchStatBlocks } from './store.svelte';

describe('searchStatBlocks', () => {
  it('matches name or type, case-insensitively', () => {
    const list = statblock.library;
    expect(searchStatBlocks(list, 'gob').map((s) => s.name)).toContain('Goblin');
    expect(searchStatBlocks(list, 'giant').length).toBeGreaterThan(0);
    expect(searchStatBlocks(list, '')).toHaveLength(list.length);
  });
});

describe('StatBlockStore encounter', () => {
  beforeEach(() => {
    statblock.clearEncounter();
    statblock.setParty(4, 3);
  });

  it('adds stat blocks to the fight and computes a live readout', () => {
    statblock.addToEncounter('ogre'); // CR 2 = 450 xp
    statblock.addToEncounter('ogre');
    expect(statblock.fight).toHaveLength(2);
    const r = statblock.readout;
    expect(r.rawXp).toBe(900);
    expect(r.multiplier).toBe(1.5); // 2 monsters
    expect(r.adjustedXp).toBe(1350);
    // party 4@3: hard=900, deadly=1600 → Hard
    expect(r.difficulty).toBe('Hard');
  });

  it('removes by index and recomputes', () => {
    statblock.addToEncounter('goblin');
    statblock.addToEncounter('troll');
    statblock.removeFromEncounter(1);
    expect(statblock.fight.map((s) => s.name)).toEqual(['Goblin']);
  });
});
