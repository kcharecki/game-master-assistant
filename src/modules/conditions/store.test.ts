import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { ConditionStore } from './store.svelte';

describe('ConditionStore', () => {
  let s: ConditionStore;
  beforeEach(() => {
    s = new ConditionStore();
  });

  it('adds and removes effects', () => {
    const e = s.add('Goblin', 'Poisoned', 2);
    expect(s.list).toHaveLength(1);
    expect(e.rounds).toBe(2);
    s.remove(e.id);
    expect(s.list).toHaveLength(0);
  });

  it('tick decrements all effects', () => {
    s.add('A', 'Blessed', 3);
    s.add('B', 'Frightened', 2);
    const expired = s.tick();
    expect(expired).toHaveLength(0);
    expect(s.list.map((e) => e.rounds).sort()).toEqual([1, 2]);
  });

  it('tick auto-expires effects that reach 0 and returns them', () => {
    s.add('A', 'Stunned', 1);
    s.add('B', 'Blessed', 3);
    const expired = s.tick();
    expect(expired).toHaveLength(1);
    expect(expired[0].name).toBe('Stunned');
    expect(s.list).toHaveLength(1);
    expect(s.list[0].name).toBe('Blessed');
  });
});
