import { describe, it, expect } from 'vitest';
import { MOODS, DEFAULT_MOOD, moodById, normalizeMood, moodStyle, grainStyle } from './mood';

describe('mood lookup', () => {
  it('finds by id and falls back to default', () => {
    expect(moodById('dread').label).toBe('Dread');
    expect(moodById('nonexistent')).toBe(DEFAULT_MOOD);
  });

  it('normalizes rehydrated values', () => {
    expect(normalizeMood({ id: 'cold' }).id).toBe('cold');
    expect(normalizeMood(null)).toBe(DEFAULT_MOOD);
    expect(normalizeMood('cold')).toBe(DEFAULT_MOOD); // not an object
  });
});

describe('moodStyle', () => {
  it('is transparent for the neutral mood', () => {
    expect(moodStyle(DEFAULT_MOOD).overlay).toBe('transparent');
    expect(moodStyle(DEFAULT_MOOD).filter).toBe('brightness(1)');
  });

  it('builds a tinted overlay + brightness filter for a real mood', () => {
    const dread = MOODS.find((m) => m.id === 'dread')!;
    const s = moodStyle(dread);
    expect(s.overlay).toContain(`rgba(${dread.tint},${dread.intensity})`);
    expect(s.filter).toBe(`brightness(${dread.brightness})`);
  });
});

describe('grainStyle', () => {
  it('gives the neutral mood a faint, colourless grain', () => {
    const g = grainStyle(DEFAULT_MOOD);
    expect(g.tint).toBe('transparent');
    expect(g.opacity).toBeCloseTo(0.06, 5);
  });

  it('tints and strengthens grain with mood intensity', () => {
    const dread = MOODS.find((m) => m.id === 'dread')!;
    const g = grainStyle(dread);
    expect(g.tint).toBe(`rgba(${dread.tint},${Math.round(dread.intensity * 0.35 * 1000) / 1000})`);
    expect(g.opacity).toBeGreaterThan(grainStyle(DEFAULT_MOOD).opacity);
    // opacity stays within a sane, subtle range
    expect(g.opacity).toBeLessThan(0.2);
  });
});
