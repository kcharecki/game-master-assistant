import { describe, it, expect } from 'vitest';
import { checkDnd, checkCoc, check } from './logic';

describe('checkDnd', () => {
  it('succeeds when d20 + mod meets the DC', () => {
    // rng=0.999 → d20 = 20
    const r = checkDnd(3, 15, () => 0.999);
    expect(r.roll).toBe(20);
    expect(r.total).toBe(23);
    expect(r.success).toBe(true);
    expect(r.margin).toBe(8);
    expect(r.crit).toBe(true);
  });

  it('fails and flags fumble on a natural 1', () => {
    const r = checkDnd(5, 10, () => 0); // d20 = 1, total 6
    expect(r.roll).toBe(1);
    expect(r.success).toBe(false);
    expect(r.fumble).toBe(true);
    expect(r.margin).toBe(-4);
  });
});

describe('checkCoc', () => {
  it('extreme success at <= skill/5', () => {
    // rng=0 → d100 = 1; skill 60 → extreme
    const r = checkCoc(60, () => 0);
    expect(r.roll).toBe(1);
    expect(r.outcome).toBe('Extreme Success');
    expect(r.success).toBe(true);
  });

  it('fumble / failure on a 100 roll', () => {
    const r = checkCoc(50, () => 0.999); // d100 = 100
    expect(r.outcome).toBe('Fumble');
    expect(r.success).toBe(false);
  });
});

describe('check (system-tuned dispatch)', () => {
  it('routes dnd5e to the d20 path', () => {
    const r = check('dnd5e', 2, 12, () => 0.999);
    expect(r.system).toBe('dnd5e');
  });
  it('routes coc7e to the d100 path', () => {
    const r = check('coc7e', 55, 0, () => 0);
    expect(r.system).toBe('coc7e');
  });
});
