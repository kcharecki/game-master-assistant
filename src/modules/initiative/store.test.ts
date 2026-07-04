import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { InitiativeStore, isBloodied, vagueStatus, type Combatant } from './store.svelte';

const make = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x',
  name: 'X',
  role: '',
  init: 10,
  foe: false,
  hp: 20,
  maxHp: 20,
  ac: 12,
  conditions: [],
  hidden: false,
  ...over,
});

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

  it('damages clamped to 0 and heals clamped to maxHp', () => {
    const c = s.add('Brute', 10, true); // defaults hp/maxHp = 10
    s.damage(c.id, 25);
    expect(s.order.find((x) => x.id === c.id)!.hp).toBe(0);
    s.heal(c.id, 100);
    expect(s.order.find((x) => x.id === c.id)!.hp).toBe(10);
  });

  it('set() edits fields and clamps hp within [0, maxHp]', () => {
    const c = s.add('Guard', 12, true); // hp/maxHp = 10
    s.set(c.id, { name: 'Captain', init: 18, ac: 16 });
    const g = () => s.order.find((x) => x.id === c.id)!;
    expect(g().name).toBe('Captain');
    expect(g().init).toBe(18);
    expect(g().ac).toBe(16);
    // lowering maxHp below hp clamps hp down
    s.set(c.id, { maxHp: 6 });
    expect(g().hp).toBe(6);
    // raising hp above maxHp clamps to maxHp
    s.set(c.id, { hp: 99 });
    expect(g().hp).toBe(6);
    // negative maxHp floors at 0
    s.set(c.id, { maxHp: -5 });
    expect(g().maxHp).toBe(0);
    expect(g().hp).toBe(0);
  });

  it('toggles conditions and hidden flag', () => {
    const c = s.add('Cultist', 10, true);
    s.toggleCondition(c.id, 'poisoned');
    expect(s.order.find((x) => x.id === c.id)!.conditions).toContain('poisoned');
    s.toggleCondition(c.id, 'poisoned');
    expect(s.order.find((x) => x.id === c.id)!.conditions).not.toContain('poisoned');
    const before = s.order.find((x) => x.id === c.id)!.hidden;
    s.toggleHidden(c.id);
    expect(s.order.find((x) => x.id === c.id)!.hidden).toBe(!before);
  });
});

describe('isBloodied', () => {
  it('is true at or below half HP while alive', () => {
    expect(isBloodied(make({ hp: 10, maxHp: 20 }))).toBe(true);
    expect(isBloodied(make({ hp: 11, maxHp: 20 }))).toBe(false);
    expect(isBloodied(make({ hp: 0, maxHp: 20 }))).toBe(false);
  });
});

describe('vagueStatus', () => {
  it('never leaks exact HP, just a tier', () => {
    expect(vagueStatus(make({ hp: 20, maxHp: 20 }))).toBe('Healthy');
    expect(vagueStatus(make({ hp: 15, maxHp: 20 }))).toBe('Wounded');
    expect(vagueStatus(make({ hp: 10, maxHp: 20 }))).toBe('Bloodied');
    expect(vagueStatus(make({ hp: 5, maxHp: 20 }))).toBe('Near death');
    expect(vagueStatus(make({ hp: 0, maxHp: 20 }))).toBe('Down');
  });
});
