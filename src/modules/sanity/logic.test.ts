import { describe, it, expect } from 'vitest';
import { parseSanLoss, sanLossRoll, BOUT_THRESHOLD } from './logic';

describe('parseSanLoss', () => {
  it('parses "1/1d6"', () => {
    expect(parseSanLoss('1/1d6')).toEqual({ pass: '1', fail: '1d6' });
  });
  it('tolerates whitespace', () => {
    expect(parseSanLoss(' 0 / 1d10 ')).toEqual({ pass: '0', fail: '1d10' });
  });
  it('rejects malformed input', () => {
    expect(parseSanLoss('nope')).toBeNull();
  });
});

describe('sanLossRoll', () => {
  // rng=0 → roll 1 (always success); flat pass loss applies.
  it('success path applies the smaller pass loss', () => {
    const r = sanLossRoll(60, { pass: '1', fail: '1d6' }, () => 0);
    expect(r.roll).toBe(1);
    expect(r.success).toBe(true);
    expect(r.loss).toBe(1);
    expect(r.remaining).toBe(59);
    expect(r.bout).toBe(false);
  });

  it('failure path rolls the larger fail loss', () => {
    // rng=0.999 → roll 100 (> SAN 50 → fail). fail "2d6" with rng~0.999 → 6+6=12.
    const r = sanLossRoll(50, { pass: '0', fail: '2d6' }, () => 0.999);
    expect(r.success).toBe(false);
    expect(r.loss).toBe(12);
    expect(r.remaining).toBe(38);
    expect(r.bout).toBe(true);
  });

  it('flags a bout of madness at the threshold', () => {
    const r = sanLossRoll(50, { pass: '0', fail: '5' }, () => 0.999);
    expect(r.loss).toBe(BOUT_THRESHOLD);
    expect(r.bout).toBe(true);
  });

  it('floors remaining SAN at 0', () => {
    const r = sanLossRoll(3, { pass: '0', fail: '1d6' }, () => 0.999);
    expect(r.remaining).toBe(0);
  });
});
