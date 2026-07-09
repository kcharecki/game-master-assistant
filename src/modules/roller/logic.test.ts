import { describe, it, expect } from 'vitest';
import {
  rollOutcome,
  rollD100,
  parseDice,
  rollDice,
  roll,
  rollCardModel,
  trimHistory,
  type HistoryEntry,
  type RollResult,
} from './logic';

describe('roller logic', () => {
  it('classifies outcomes against a skill of 50', () => {
    expect(rollOutcome(5)).toBe('Extreme Success'); // <= 50/5
    expect(rollOutcome(40)).toBe('Regular Success');
    expect(rollOutcome(80)).toBe('Failure');
    expect(rollOutcome(98)).toBe('Fumble');
  });

  it('respects a custom skill threshold', () => {
    expect(rollOutcome(70, 80)).toBe('Regular Success');
    expect(rollOutcome(16, 80)).toBe('Extreme Success'); // <= 80/5
  });

  it('rolls within 1..100 with an injectable rng', () => {
    expect(rollD100(() => 0)).toBe(1);
    expect(rollD100(() => 0.999)).toBe(100);
  });
});

describe('parseDice', () => {
  it('parses NdM+K, dM, and negative modifiers', () => {
    expect(parseDice('2d6+3')).toEqual({ count: 2, sides: 6, modifier: 3 });
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(parseDice('1d8-1')).toEqual({ count: 1, sides: 8, modifier: -1 });
    expect(parseDice(' 3 d 10 ')).toEqual({ count: 3, sides: 10, modifier: 0 });
  });

  it('returns null on garbage', () => {
    expect(parseDice('hello')).toBeNull();
    expect(parseDice('d0')).toBeNull();
    expect(parseDice('0d6')).toBeNull();
  });
});

describe('rollDice', () => {
  const max = () => 0.999;
  const min = () => 0;

  it('sums dice plus modifier', () => {
    const r = rollDice({ count: 2, sides: 6, modifier: 3 }, 'normal', false, max);
    expect(r.rolls).toEqual([6, 6]);
    expect(r.total).toBe(15);
  });

  it('advantage keeps the higher of two d20', () => {
    let first = true;
    const rng = () => {
      const v = first ? 0 : 0.999; // 1 then 20
      first = false;
      return v;
    };
    const r = rollDice({ count: 1, sides: 20, modifier: 0 }, 'advantage', false, rng);
    expect(r.rolls).toEqual([1, 20]);
    expect(r.kept).toEqual([20]);
    expect(r.total).toBe(20);
  });

  it('disadvantage keeps the lower of two d20', () => {
    let first = true;
    const rng = () => {
      const v = first ? 0.999 : 0; // 20 then 1
      first = false;
      return v;
    };
    const r = rollDice({ count: 1, sides: 20, modifier: 0 }, 'disadvantage', false, rng);
    expect(r.kept).toEqual([1]);
  });

  it('carries the hidden flag through', () => {
    expect(rollDice({ count: 1, sides: 4, modifier: 0 }, 'normal', true, min).hidden).toBe(true);
  });
});

describe('roll', () => {
  it('parses and rolls in one call', () => {
    const r = roll('1d20+1', 'normal', false, () => 0);
    expect(r?.total).toBe(2);
  });

  it('returns null for a bad expression', () => {
    expect(roll('nope')).toBeNull();
  });
});

describe('rollCardModel', () => {
  it('strips the hidden flag and copies the roll fields', () => {
    const r: RollResult = { rolls: [4, 5], kept: [4, 5], modifier: 2, total: 11, hidden: true };
    const card = rollCardModel(r, '2d6+2', 'Attack');
    expect(card).toEqual({
      label: 'Attack',
      expr: '2d6+2',
      rolls: [4, 5],
      kept: [4, 5],
      modifier: 2,
      total: 11,
    });
    expect('hidden' in card).toBe(false);
  });

  it('copies rolls/kept into fresh arrays (never the source reference)', () => {
    // The Desktop passes a reactive ($state) RollResult whose arrays are proxies
    // that can't be structured-cloned across the BroadcastChannel. The card must
    // hold plain copies, or `air` throws DataCloneError and nothing airs.
    const r: RollResult = { rolls: [4, 5], kept: [4], modifier: 0, total: 4, hidden: false };
    const card = rollCardModel(r, '2d6');
    expect(card.rolls).toEqual([4, 5]);
    expect(card.kept).toEqual([4]);
    expect(card.rolls).not.toBe(r.rolls);
    expect(card.kept).not.toBe(r.kept);
    // Structured-clone must succeed (mirrors what postMessage does).
    expect(() => structuredClone(card)).not.toThrow();
  });

  it('omits an empty label', () => {
    const r: RollResult = { rolls: [3], kept: [3], modifier: 0, total: 3, hidden: false };
    expect(rollCardModel(r, '1d20').label).toBeUndefined();
  });

  it('attaches a CoC outcome tier for a single d100', () => {
    const r: RollResult = { rolls: [5], kept: [5], modifier: 0, total: 5, hidden: false };
    expect(rollCardModel(r, '1d100').outcome).toBe('Extreme Success');
    const fail: RollResult = { rolls: [80], kept: [80], modifier: 0, total: 80, hidden: false };
    expect(rollCardModel(fail, 'd100').outcome).toBe('Failure');
  });

  it('does not attach an outcome for non-d100 rolls', () => {
    const r: RollResult = { rolls: [12], kept: [12], modifier: 0, total: 12, hidden: false };
    expect(rollCardModel(r, '1d20').outcome).toBeUndefined();
  });
});

describe('trimHistory', () => {
  const mk = (id: string): HistoryEntry => ({
    id,
    expr: '1d20',
    result: { rolls: [1], kept: [1], modifier: 0, total: 1, hidden: false },
    at: 0,
  });

  it('prepends the newest entry', () => {
    const out = trimHistory([mk('a')], mk('b'), 20);
    expect(out.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('trims to the newest max entries', () => {
    let hist: HistoryEntry[] = [];
    for (let i = 0; i < 25; i++) hist = trimHistory(hist, mk(String(i)), 20);
    expect(hist).toHaveLength(20);
    expect(hist[0].id).toBe('24');
    expect(hist[19].id).toBe('5');
  });
});
