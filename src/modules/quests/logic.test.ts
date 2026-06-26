import { describe, it, expect } from 'vitest';
import { counts, byStatus, type Quest } from './logic';

const quests: Quest[] = [
  { id: 'a', title: 'Find the relic', status: 'open', clues: ['map fragment'], notes: '' },
  { id: 'b', title: 'Rescue the smith', status: 'resolved', clues: [], notes: '' },
  { id: 'c', title: 'Cult plot', status: 'open', clues: [], notes: '' },
];

describe('counts', () => {
  it('tallies open / resolved / total', () => {
    expect(counts(quests)).toEqual({ open: 2, resolved: 1, total: 3 });
  });
  it('handles empty', () => {
    expect(counts([])).toEqual({ open: 0, resolved: 0, total: 0 });
  });
});

describe('byStatus', () => {
  it('filters open', () => {
    expect(byStatus(quests, 'open').map((q) => q.id)).toEqual(['a', 'c']);
  });
  it('filters resolved', () => {
    expect(byStatus(quests, 'resolved').map((q) => q.id)).toEqual(['b']);
  });
});
