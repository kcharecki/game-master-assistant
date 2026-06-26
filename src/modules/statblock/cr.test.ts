import { describe, it, expect } from 'vitest';
import {
  xpForCr,
  partyThresholds,
  encounterMultiplier,
  adjustedXp,
  difficulty,
  evaluateEncounter,
} from './cr';

describe('xpForCr', () => {
  it('maps known CRs and zero for unknown', () => {
    expect(xpForCr('1/4')).toBe(50);
    expect(xpForCr('5')).toBe(1800);
    expect(xpForCr('99')).toBe(0);
  });
});

describe('partyThresholds', () => {
  it('scales per-character thresholds by party size', () => {
    // 4 level-3 PCs: medium = 150 * 4 = 600, deadly = 400 * 4 = 1600
    const t = partyThresholds(4, 3);
    expect(t.medium).toBe(600);
    expect(t.deadly).toBe(1600);
  });
  it('clamps level into the supported 1..10 range', () => {
    expect(partyThresholds(1, 99)).toEqual(partyThresholds(1, 10));
  });
});

describe('encounterMultiplier', () => {
  it('follows the DMG action-economy bands', () => {
    expect(encounterMultiplier(1)).toBe(1);
    expect(encounterMultiplier(2)).toBe(1.5);
    expect(encounterMultiplier(3)).toBe(2);
    expect(encounterMultiplier(7)).toBe(2.5);
    expect(encounterMultiplier(11)).toBe(3);
    expect(encounterMultiplier(15)).toBe(4);
  });
});

describe('adjustedXp', () => {
  it('applies the multiplier to raw XP', () => {
    // two CR 1 (200 each) → raw 400, x1.5 = 600
    expect(adjustedXp(['1', '1'])).toBe(600);
  });
});

describe('difficulty + evaluateEncounter', () => {
  it('classifies against thresholds', () => {
    const t = partyThresholds(4, 3); // easy 300, med 600, hard 900, deadly 1600
    expect(difficulty(200, t)).toBe('Trivial');
    expect(difficulty(650, t)).toBe('Medium');
    expect(difficulty(1600, t)).toBe('Deadly');
  });

  it('produces a full readout', () => {
    // 4x CR 1 → raw 800, x2 = 1600 adjusted; party 4@3 deadly=1600 → Deadly
    const r = evaluateEncounter(['1', '1', '1', '1'], 4, 3);
    expect(r.rawXp).toBe(800);
    expect(r.multiplier).toBe(2);
    expect(r.adjustedXp).toBe(1600);
    expect(r.difficulty).toBe('Deadly');
  });
});
