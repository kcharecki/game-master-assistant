import { describe, it, expect } from 'vitest';
import { systemConfig, isRelevantTo, SYSTEMS } from './system';

describe('systemConfig', () => {
  it('D&D 5e defaults to d20 dice mode', () => {
    const c = systemConfig('dnd5e');
    expect(c.label).toBe('D&D 5e');
    expect(c.diceMode).toBe('d20');
  });

  it('CoC 7e defaults to d100 dice mode', () => {
    const c = systemConfig('coc7e');
    expect(c.label).toBe('CoC 7e');
    expect(c.diceMode).toBe('d100');
  });

  it('lists exactly the two supported systems', () => {
    expect(SYSTEMS).toEqual(['dnd5e', 'coc7e']);
  });
});

describe('isRelevantTo', () => {
  it('routes statblock/encounter to D&D, sanity/clues to CoC', () => {
    expect(isRelevantTo('statblock', 'dnd5e')).toBe(true);
    expect(isRelevantTo('encounter', 'dnd5e')).toBe(true);
    expect(isRelevantTo('sanity', 'dnd5e')).toBe(false);

    expect(isRelevantTo('sanity', 'coc7e')).toBe(true);
    expect(isRelevantTo('clues', 'coc7e')).toBe(true);
    expect(isRelevantTo('statblock', 'coc7e')).toBe(false);
  });
});
