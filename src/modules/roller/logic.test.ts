import { describe, it, expect } from 'vitest';
import { rollOutcome, rollD100, parseDice, rollDice, roll } from './logic';

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
