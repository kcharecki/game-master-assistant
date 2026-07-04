import { describe, it, expect } from 'vitest';
import {
  newBeat,
  moveBeat,
  stepCursor,
  beatRefs,
  threadTally,
  type Beat,
  type Thread,
} from './logic';

function beats(...titles: string[]): Beat[] {
  return titles.map((tt) => ({ ...newBeat(tt), id: tt }));
}

describe('moveBeat', () => {
  it('moves a beat up', () => {
    const out = moveBeat(beats('a', 'b', 'c'), 'b', -1);
    expect(out.map((b) => b.id)).toEqual(['b', 'a', 'c']);
  });
  it('moves a beat down', () => {
    const out = moveBeat(beats('a', 'b', 'c'), 'b', 1);
    expect(out.map((b) => b.id)).toEqual(['a', 'c', 'b']);
  });
  it('is a no-op at the top edge', () => {
    const input = beats('a', 'b');
    expect(moveBeat(input, 'a', -1)).toBe(input);
  });
  it('is a no-op at the bottom edge', () => {
    const input = beats('a', 'b');
    expect(moveBeat(input, 'b', 1)).toBe(input);
  });
  it('is a no-op for an unknown id', () => {
    const input = beats('a', 'b');
    expect(moveBeat(input, 'z', 1)).toBe(input);
  });
});

describe('stepCursor', () => {
  const list = beats('a', 'b', 'c');
  it('advances forward', () => {
    expect(stepCursor(list, 'a', 1)).toBe('b');
  });
  it('steps backward', () => {
    expect(stepCursor(list, 'b', -1)).toBe('a');
  });
  it('clamps at the end', () => {
    expect(stepCursor(list, 'c', 1)).toBe('c');
  });
  it('clamps at the start', () => {
    expect(stepCursor(list, 'a', -1)).toBe('a');
  });
  it('returns undefined for an empty list', () => {
    expect(stepCursor([], undefined, 1)).toBeUndefined();
  });
  it('falls back to the first beat when the cursor is unknown', () => {
    expect(stepCursor(list, 'gone', 1)).toBe('a');
  });
});

describe('beatRefs', () => {
  it('pulls @npc mentions then [[lore]] links', () => {
    const refs = beatRefs('Talk to @Zadok Allen near the [[Marsh Refinery]].');
    expect(refs).toEqual([
      { kind: 'npc', name: 'zadok' },
      { kind: 'lore', name: 'Marsh Refinery' },
    ]);
  });
  it('returns nothing for a plain body', () => {
    expect(beatRefs('just prose')).toEqual([]);
  });
});

describe('threadTally', () => {
  it('counts open vs resolved', () => {
    const threads: Thread[] = [
      { id: '1', text: 'x', resolved: false },
      { id: '2', text: 'y', resolved: true },
      { id: '3', text: 'z', resolved: false },
    ];
    expect(threadTally(threads)).toEqual({ open: 2, resolved: 1 });
  });
});
