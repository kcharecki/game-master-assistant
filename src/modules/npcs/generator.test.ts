import { describe, it, expect } from 'vitest';
import { generateNpc, type Rng } from './generator';

/** An rng that walks a fixed sequence of [0,1) values, wrapping. */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateNpc', () => {
  it('is deterministic for a given rng', () => {
    const a = generateNpc(seq([0, 0, 0, 0]));
    const b = generateNpc(seq([0, 0, 0, 0]));
    expect(a).toEqual(b);
  });

  it('picks the first entry of each table at rng=0', () => {
    const npc = generateNpc(seq([0, 0, 0, 0]));
    expect(npc.name).toBe('Bram Calloway');
    expect(npc.trait).toBe('twitchy and overcaffeinated');
    expect(npc.motivation).toBe('wants to pay off a gambling debt');
    expect(npc.mannerism).toBe('cracks knuckles before speaking');
  });

  it('draws a distinct field from each table in order', () => {
    // rng yields 0 (name), 0.5 (trait), 0.25 (motivation), 0.99 (mannerism)
    const npc = generateNpc(seq([0, 0.5, 0.25, 0.99]));
    expect(npc.name).toBe('Bram Calloway');
    expect(npc.trait).toBe('gruff but kind');
    expect(npc.motivation).toBe('seeks revenge against a former employer');
    expect(npc.mannerism).toBe('finishes others’ sentences');
  });

  it('always returns a fully-populated npc with the default rng', () => {
    const npc = generateNpc();
    for (const v of Object.values(npc)) expect(v.length).toBeGreaterThan(0);
  });
});
