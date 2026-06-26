import { describe, it, expect } from 'vitest';
import { byPerception, topPerception, type PartyMember } from './logic';

const party: PartyMember[] = [
  { id: 'a', name: 'Asha', ac: 16, pp: 12 },
  { id: 'b', name: 'Bram', ac: 18, pp: 15 },
  { id: 'c', name: 'Cora', ac: 14, pp: 15 },
];

describe('byPerception', () => {
  it('sorts by passive Perception desc, then name', () => {
    expect(byPerception(party).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('does not mutate input', () => {
    const copy = [...party];
    byPerception(party);
    expect(party).toEqual(copy);
  });
});

describe('topPerception', () => {
  it('returns the highest pp, 0 when empty', () => {
    expect(topPerception(party)).toBe(15);
    expect(topPerception([])).toBe(0);
  });
});
