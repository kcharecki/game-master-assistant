import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { InitiativeStore } from './store.svelte';

describe('InitiativeStore', () => {
  let s: InitiativeStore;
  beforeEach(() => {
    s = new InitiativeStore();
    for (const c of [...s.order]) s.remove(c.id);
  });

  it('adds and removes combatants', () => {
    const a = s.add('Goblin', 14, true);
    expect(s.order).toHaveLength(1);
    expect(a.foe).toBe(true);
    s.remove(a.id);
    expect(s.order).toHaveLength(0);
  });

  it('advances active marker and wraps to next round', () => {
    s.add('A', 20);
    s.add('B', 15);
    expect(s.active).toBe(0);
    expect(s.round).toBe(1);
    s.nextTurn();
    expect(s.active).toBe(1);
    expect(s.round).toBe(1);
    s.nextTurn(); // wrap
    expect(s.active).toBe(0);
    expect(s.round).toBe(2);
  });

  it('reorders via moveUp / moveDown', () => {
    const a = s.add('A', 20);
    const b = s.add('B', 15);
    s.moveUp(b.id);
    expect(s.order[0].id).toBe(b.id);
    expect(s.order[1].id).toBe(a.id);
    s.moveDown(b.id);
    expect(s.order[0].id).toBe(a.id);
    expect(s.order[1].id).toBe(b.id);
  });

  it('keeps the active marker valid after removing combatants', () => {
    const a = s.add('A', 20);
    s.add('B', 15);
    s.add('C', 10);
    s.nextTurn();
    s.nextTurn(); // active = 2 (C)
    expect(s.active).toBe(2);
    s.remove(a.id); // removing before active shifts it down
    expect(s.active).toBe(1);
    // removing the active tail clamps into range
    s.active = s.order.length - 1;
    s.remove(s.order[s.order.length - 1].id);
    expect(s.active).toBeLessThan(s.order.length);
  });

  it('reset returns to round 1, top of order', () => {
    s.add('A', 20);
    s.add('B', 15);
    s.nextTurn();
    s.nextTurn();
    s.reset();
    expect(s.active).toBe(0);
    expect(s.round).toBe(1);
  });
});
