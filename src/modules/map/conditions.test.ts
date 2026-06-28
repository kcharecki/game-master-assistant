import { describe, it, expect } from 'vitest';
import { conditionsFor, conditionMeta, conditionGlyph } from './conditions';

describe('token conditions catalog', () => {
  it('lists the 15 D&D 5e conditions and 13 CoC 7e states', () => {
    expect(conditionsFor('dnd5e')).toHaveLength(15);
    expect(conditionsFor('coc7e')).toHaveLength(13);
  });

  it('has unique ids per system and a glyph for each', () => {
    for (const sys of ['dnd5e', 'coc7e'] as const) {
      const list = conditionsFor(sys);
      const ids = new Set(list.map((c) => c.id));
      expect(ids.size).toBe(list.length);
      expect(list.every((c) => c.glyph.length > 0 && c.label.length > 0)).toBe(true);
    }
  });

  it('resolves meta + glyph by id, with a fallback', () => {
    expect(conditionMeta('poisoned')?.label).toBe('Poisoned');
    expect(conditionGlyph('major-wound')).toBe('🩸');
    expect(conditionMeta('nope')).toBeUndefined();
    expect(conditionGlyph('nope')).toBe('•');
  });
});
