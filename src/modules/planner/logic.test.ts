import { describe, it, expect } from 'vitest';
import {
  newBeat,
  moveBeat,
  reorderBeats,
  groupByAct,
  beatCue,
  nextBeat,
  stepCursor,
  beatRefs,
  branchTarget,
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

describe('reorderBeats', () => {
  it('moves a beat down to a later slot', () => {
    const out = reorderBeats(beats('a', 'b', 'c', 'd'), 'a', 'c');
    expect(out.map((b) => b.id)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves a beat up to an earlier slot', () => {
    const out = reorderBeats(beats('a', 'b', 'c', 'd'), 'd', 'b');
    expect(out.map((b) => b.id)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('is a no-op for a self-move', () => {
    const input = beats('a', 'b');
    expect(reorderBeats(input, 'a', 'a')).toBe(input);
  });
  it('is a no-op for an unknown id', () => {
    const input = beats('a', 'b');
    expect(reorderBeats(input, 'z', 'a')).toBe(input);
  });
});

describe('groupByAct', () => {
  it('buckets consecutive beats by act label', () => {
    const list: Beat[] = [
      { ...newBeat('a'), id: 'a', act: 'I' },
      { ...newBeat('b'), id: 'b', act: 'I' },
      { ...newBeat('c'), id: 'c', act: 'II' },
    ];
    const groups = groupByAct(list);
    expect(groups.map((g) => g.act)).toEqual(['I', 'II']);
    expect(groups[0].beats.map((b) => b.id)).toEqual(['a', 'b']);
    expect(groups[1].beats.map((b) => b.id)).toEqual(['c']);
  });
  it('keeps un-acted beats in a blank-keyed group', () => {
    const groups = groupByAct(beats('a', 'b'));
    expect(groups).toHaveLength(1);
    expect(groups[0].act).toBe('');
  });
});

describe('beatCue', () => {
  it('returns the first non-empty line', () => {
    expect(beatCue('\n  \nFirst cue\nsecond line')).toBe('First cue');
  });
  it('returns empty for a blank body', () => {
    expect(beatCue('   \n\n')).toBe('');
  });
});

describe('nextBeat', () => {
  const list = beats('a', 'b', 'c');
  it('returns the following beat', () => {
    expect(nextBeat(list, 'b')?.id).toBe('c');
  });
  it('returns undefined at the end', () => {
    expect(nextBeat(list, 'c')).toBeUndefined();
  });
  it('returns undefined for an unknown cursor', () => {
    expect(nextBeat(list, 'gone')).toBeUndefined();
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

describe('branchTarget', () => {
  const list = beats('Cold open', 'The Innkeeper', 'Arrival on Federal St.');
  it('matches a beat title case- and whitespace-insensitively', () => {
    expect(branchTarget(list, 'the  innkeeper ')).toBe('The Innkeeper');
    expect(branchTarget(list, 'ARRIVAL ON FEDERAL ST.')).toBe('Arrival on Federal St.');
  });
  it('returns undefined for a terminal outcome with no matching beat', () => {
    expect(branchTarget(list, 'He panics and flees')).toBeUndefined();
  });
  it('returns undefined for an empty label', () => {
    expect(branchTarget(list, '   ')).toBeUndefined();
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
