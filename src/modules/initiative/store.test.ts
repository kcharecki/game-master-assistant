import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { InitiativeStore, isBloodied, vagueStatus, type Combatant } from './store.svelte';
import { kvSet } from '../../lib/db';

const make = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x',
  name: 'X',
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
    expect(s.activeId).toBeNull();
  });

  it('adds and removes combatants, keeping the list init-sorted', () => {
    const a = s.add('Goblin', 14, true);
    expect(s.order).toHaveLength(1);
    expect(a.foe).toBe(true);
    expect(s.activeId).toBe(a.id); // first add takes the turn
    const b = s.add('Ogre', 20, true);
    expect(s.order[0].id).toBe(b.id); // higher init sorts to top
    s.remove(a.id);
    expect(s.order).toHaveLength(1);
  });

  it('advances the active combatant and wraps to the next round', () => {
    const a = s.add('A', 20);
    const b = s.add('B', 15);
    expect(s.activeId).toBe(a.id);
    expect(s.round).toBe(1);
    s.nextTurn();
    expect(s.activeId).toBe(b.id);
    expect(s.round).toBe(1);
    s.nextTurn(); // wrap
    expect(s.activeId).toBe(a.id);
    expect(s.round).toBe(2);
  });

  it('ticks timed conditions down on round wrap and drops the expired', () => {
    const a = s.add('A', 20);
    s.add('B', 15);
    s.toggleCondition(a.id, 'Poisoned'); // rounds = null (indefinite)
    s.cycleDuration(a.id, 'Poisoned'); // -> 3
    s.cycleDuration(a.id, 'Poisoned'); // -> 2
    s.cycleDuration(a.id, 'Poisoned'); // -> 1
    s.nextTurn();
    s.nextTurn(); // wrap: 1 -> 0 => expired
    expect(s.order.find((x) => x.id === a.id)!.conditions).toHaveLength(0);
  });

  it('leaves indefinite conditions untouched across rounds', () => {
    const a = s.add('A', 20);
    s.add('B', 15);
    s.toggleCondition(a.id, 'Prone'); // rounds = null
    s.nextTurn();
    s.nextTurn(); // wrap
    expect(s.order.find((x) => x.id === a.id)!.conditions[0]).toEqual({ name: 'Prone', rounds: null });
  });

  it('cycles a condition duration ∞ -> 3 -> 2 -> 1 -> ∞', () => {
    const a = s.add('A', 20);
    const dur = () => s.order.find((x) => x.id === a.id)!.conditions[0].rounds;
    s.toggleCondition(a.id, 'Stunned');
    expect(dur()).toBeNull();
    s.cycleDuration(a.id, 'Stunned');
    expect(dur()).toBe(3);
    s.cycleDuration(a.id, 'Stunned');
    expect(dur()).toBe(2);
    s.cycleDuration(a.id, 'Stunned');
    expect(dur()).toBe(1);
    s.cycleDuration(a.id, 'Stunned');
    expect(dur()).toBeNull();
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

  it('drag-reorders: downward drop lands after target, upward before', () => {
    const a = s.add('A', 30);
    const b = s.add('B', 20);
    const c = s.add('C', 10); // order: A, B, C
    s.reorder(a.id, c.id); // drag A down onto C
    expect(s.order.map((x) => x.id)).toEqual([b.id, c.id, a.id]);
    s.reorder(a.id, b.id); // drag A up onto B
    expect(s.order.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
  });

  it('keeps the active combatant when removing others', () => {
    const a = s.add('A', 20);
    const b = s.add('B', 15);
    s.add('C', 10);
    s.nextTurn(); // active = B
    expect(s.activeId).toBe(b.id);
    s.remove(a.id); // removing a non-active combatant keeps active pointed at B
    expect(s.activeId).toBe(b.id);
  });

  it('moves the active pointer to a neighbour when the active combatant is removed', () => {
    const a = s.add('A', 20);
    const b = s.add('B', 15);
    expect(s.activeId).toBe(a.id);
    s.remove(a.id);
    expect(s.activeId).toBe(b.id);
    s.remove(b.id);
    expect(s.activeId).toBeNull();
  });

  it('reset returns to round 1, top of order', () => {
    const a = s.add('A', 20);
    s.add('B', 15);
    s.nextTurn();
    s.nextTurn();
    s.reset();
    expect(s.activeId).toBe(a.id);
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
    s.set(c.id, { name: 'Captain', ac: 16 });
    const g = () => s.order.find((x) => x.id === c.id)!;
    expect(g().name).toBe('Captain');
    expect(g().ac).toBe(16);
    s.set(c.id, { maxHp: 6 });
    expect(g().hp).toBe(6);
    s.set(c.id, { hp: 99 });
    expect(g().hp).toBe(6);
    s.set(c.id, { maxHp: -5 });
    expect(g().maxHp).toBe(0);
    expect(g().hp).toBe(0);
  });

  it('sorts by initiative after an init edit', () => {
    const a = s.add('A', 20);
    const b = s.add('B', 15);
    s.set(b.id, { init: 99 });
    s.sortByInit();
    expect(s.order[0].id).toBe(b.id);
    expect(s.order[1].id).toBe(a.id);
  });

  it('toggles conditions, hidden, and foe flags', () => {
    const c = s.add('Cultist', 10, true);
    s.toggleCondition(c.id, 'Poisoned');
    expect(s.order.find((x) => x.id === c.id)!.conditions).toContainEqual({ name: 'Poisoned', rounds: null });
    s.toggleCondition(c.id, 'Poisoned');
    expect(s.order.find((x) => x.id === c.id)!.conditions).toHaveLength(0);
    const hidden = s.order.find((x) => x.id === c.id)!.hidden;
    s.toggleHidden(c.id);
    expect(s.order.find((x) => x.id === c.id)!.hidden).toBe(!hidden);
    const foe = s.order.find((x) => x.id === c.id)!.foe;
    s.toggleFoe(c.id);
    expect(s.order.find((x) => x.id === c.id)!.foe).toBe(!foe);
  });
});

describe('persist / flush (debounced IndexedDB write)', () => {
  let s: InitiativeStore;
  beforeEach(() => {
    vi.useFakeTimers();
    s = new InitiativeStore();
    vi.mocked(kvSet).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('debounces: no write until the interval elapses', () => {
    s.add('A', 10);
    expect(vi.mocked(kvSet)).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(vi.mocked(kvSet)).toHaveBeenCalledTimes(1);
  });

  it('flush() forces the pending write immediately', () => {
    s.add('A', 10);
    expect(vi.mocked(kvSet)).not.toHaveBeenCalled();
    s.flush();
    expect(vi.mocked(kvSet)).toHaveBeenCalledWith(
      'initiative',
      expect.objectContaining({ round: 1 }),
    );
  });

  it('coalesces rapid edits into a single write', () => {
    s.add('A', 10);
    s.add('B', 12);
    s.add('C', 8);
    vi.advanceTimersByTime(200);
    expect(vi.mocked(kvSet)).toHaveBeenCalledTimes(1);
  });

  it('flush() is a no-op when nothing is pending', () => {
    s.flush();
    expect(vi.mocked(kvSet)).not.toHaveBeenCalled();
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
