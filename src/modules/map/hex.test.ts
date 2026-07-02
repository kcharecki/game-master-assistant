import { describe, it, expect } from 'vitest';
import { hexGridPath } from './hex';

describe('hexGridPath', () => {
  it('produces a closed multi-hex path for a non-empty grid', () => {
    const d = hexGridPath(4, 3, 48);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('Z');
    // one 'M…Z' per hex; a 4×3 area yields several hexes.
    expect((d.match(/Z/g) ?? []).length).toBeGreaterThan(3);
  });

  it('covers a larger area with more hexes', () => {
    const small = (hexGridPath(2, 2, 48).match(/Z/g) ?? []).length;
    const big = (hexGridPath(10, 10, 48).match(/Z/g) ?? []).length;
    expect(big).toBeGreaterThan(small);
  });
});
