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
  plannedMinutes,
  layoutGraph,
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

describe('plannedMinutes', () => {
  it('sums beat time budgets, skipping unset ones', () => {
    const list: Beat[] = [
      { ...newBeat('a'), id: 'a', mins: 10 },
      { ...newBeat('b'), id: 'b' },
      { ...newBeat('c'), id: 'c', mins: 25 },
    ];
    expect(plannedMinutes(list)).toBe(35);
  });
  it('is 0 for an empty plan', () => {
    expect(plannedMinutes([])).toBe(0);
  });
});

describe('layoutGraph', () => {
  /** a→b→c chained by bare (condition-less) branches. */
  function chain(...t: string[]): Beat[] {
    const bs = beats(...t);
    for (let i = 0; i < bs.length - 1; i++) bs[i].branches = [{ id: `n${i}`, cond: '', to: bs[i + 1].id }];
    return bs;
  }

  it('places a chained plan on a spine, x ascending by depth', () => {
    const g = layoutGraph(chain('a', 'b', 'c'), 'b');
    const spine = g.nodes.filter((n) => n.kind === 'beat');
    expect(spine.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(spine[0].x).toBeLessThan(spine[1].x);
    expect(spine[1].x).toBeLessThan(spine[2].x);
    expect(new Set(spine.map((n) => n.y)).size).toBe(1); // one row
  });

  it('drops unwired beats into a floating tray, never auto-connecting them', () => {
    const g = layoutGraph(beats('a', 'b', 'c'), 'b');
    expect(g.edges).toHaveLength(0); // no implicit chaining
    // all three land on the same (tray) row, still no edges between them
    expect(new Set(g.nodes.map((n) => n.y)).size).toBe(1);
  });

  it('flags the cursor beat and its outgoing edge', () => {
    const g = layoutGraph(chain('a', 'b', 'c'), 'b');
    expect(g.nodes.find((n) => n.id === 'b')?.cursor).toBe(true);
    const out = g.edges.find((e) => e.from === 'b');
    expect(out?.cursor).toBe(true);
  });

  it('renders a condition-less branch as a plain sequential arrow', () => {
    const g = layoutGraph(chain('a', 'b'), 'a');
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].kind).toBe('seq');
    expect(g.edges[0].label).toBeUndefined();
    expect(g.edges[0].to).toBe('b');
  });

  it('draws a fork edge to a matching beat and a terminal card otherwise', () => {
    const list = beats('start', 'chapel');
    list[0].branches = [
      { id: 'x', cond: 'pay', to: 'chapel' },
      { id: 'y', cond: 'flee', to: 'They vanish' },
    ];
    const g = layoutGraph(list, 'start');
    const fork = g.edges.find((e) => e.id === 'fork:x');
    expect(fork?.kind).toBe('fork');
    expect(fork?.to).toBe('chapel');
    const termNode = g.nodes.find((n) => n.kind === 'terminal');
    expect(termNode?.title).toBe('They vanish');
    expect(g.edges.find((e) => e.kind === 'terminal')?.to).toBe(termNode?.id);
  });

  it('marks a backward branch as a loop-back', () => {
    const list = beats('a', 'b', 'c');
    list[2].branches = [{ id: 'lp', cond: 'lost', to: 'a' }];
    const g = layoutGraph(list, 'c');
    expect(g.edges.find((e) => e.id === 'fork:lp')?.kind).toBe('loop');
  });

  it('fans sibling forks into distinct rows so no two cards overlap', () => {
    const list = beats('a', 'b');
    list[0].branches = [
      { id: '1', cond: 'x', to: 'end one' },
      { id: '2', cond: 'y', to: 'end two' },
      { id: '3', cond: 'z', to: 'b' },
    ];
    const g = layoutGraph(list, 'a');
    const pos = g.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(pos).size).toBe(pos.length); // every card at a unique slot
  });

  it('returns an empty graph for an empty plan without throwing', () => {
    const g = layoutGraph([], undefined);
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
    expect(g.width).toBeGreaterThan(0);
    expect(g.height).toBeGreaterThan(0);
  });

  it('ignores a branch that points at its own beat (no self-edge)', () => {
    const list = beats('a', 'b');
    list[0].branches = [{ id: 's', cond: 'loop on self', to: 'a' }];
    const g = layoutGraph(list, 'a');
    expect(g.edges.some((e) => e.from === 'a' && e.to === 'a')).toBe(false);
    expect(g.nodes.every((n) => n.kind === 'beat')).toBe(true); // no stray terminal
  });

  it('lifts a column-skipping edge off the spine row it passes', () => {
    // a→c fork skips b, which is chained a→b→c: the fork must not ride b's row.
    const list = beats('a', 'b', 'c');
    list[0].branches = [
      { id: 'seq', cond: '', to: 'b' },
      { id: 'skip', cond: 'shortcut', to: 'c' },
    ];
    list[1].branches = [{ id: 'b2c', cond: '', to: 'c' }];
    const g = layoutGraph(list, 'a');
    const b = g.nodes.find((n) => n.id === 'b')!;
    const skip = g.edges.find((e) => e.id === 'fork:skip')!;
    // the skip edge spans 2 columns → routed as a lane path (not a single cubic)
    expect(skip.d).toContain('L ');
    // its lane must sit clear of b's card band
    expect(Math.abs(skip.ly - (b.y + b.h / 2))).toBeGreaterThan(b.h / 2);
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
