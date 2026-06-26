import { describe, it, expect } from 'vitest';
import { spotlightRows, type Player } from './logic';

const NOW = 100_000_000;
const MIN = 60_000;

const players: Player[] = [
  { id: 'a', name: 'Asha', last: NOW - 2 * MIN },
  { id: 'b', name: 'Bram', last: NOW - 30 * MIN },
  { id: 'c', name: 'Cora', last: 0 }, // never
];

describe('spotlightRows', () => {
  it('sorts most-overdue first, never-spotlighted at the top', () => {
    const rows = spotlightRows(players, NOW, 15 * MIN);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows[0].sinceMs).toBe(Infinity);
  });

  it('flags overdue against the threshold', () => {
    const rows = spotlightRows(players, NOW, 15 * MIN);
    const by = Object.fromEntries(rows.map((r) => [r.id, r.overdue]));
    expect(by).toEqual({ a: false, b: true, c: true });
  });

  it('breaks ties by name', () => {
    const tied: Player[] = [
      { id: 'z', name: 'Zed', last: NOW - MIN },
      { id: 'm', name: 'Mira', last: NOW - MIN },
    ];
    expect(spotlightRows(tied, NOW, MIN).map((r) => r.name)).toEqual(['Mira', 'Zed']);
  });
});
