import { describe, it, expect } from 'vitest';
import { rollOutcome, rollD100 } from './logic';

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
