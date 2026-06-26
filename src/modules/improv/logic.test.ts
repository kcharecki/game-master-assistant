import { describe, it, expect } from 'vitest';
import { improvPrompt } from './logic';

describe('improvPrompt', () => {
  it('returns a complication for rng leading to the first kind', () => {
    const p = improvPrompt(() => 0);
    expect(p.kind).toBe('complication');
    expect(p.text.length).toBeGreaterThan(0);
  });

  it('selects kind from the first draw, entry from the second', () => {
    const seq = [0.5, 0]; // 0.5*3 -> kind index 1 (twist); 0 -> first twist
    let i = 0;
    const p = improvPrompt(() => seq[i++]);
    expect(p.kind).toBe('twist');
  });

  it('always yields one of the three kinds', () => {
    for (let r = 0; r < 1; r += 0.1) {
      expect(['complication', 'twist', 'npc']).toContain(improvPrompt(() => r).kind);
    }
  });
});
