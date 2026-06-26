import { describe, it, expect } from 'vitest';
import { filterNpcs } from './roster';
import type { Npc } from './store.svelte';

const ros: Npc[] = [
  { id: '1', name: 'Captain Eli Thorne', role: 'Harbormaster', disposition: 'ally' },
  { id: '2', name: 'Mara Whitlock', role: 'Archivist', disposition: 'ally' },
  { id: '3', name: 'Deep One Hybrid', role: 'Monster', disposition: 'hostile' },
];

describe('filterNpcs', () => {
  it('returns the full list for a blank query', () => {
    expect(filterNpcs(ros, '')).toHaveLength(3);
    expect(filterNpcs(ros, '   ')).toHaveLength(3);
  });

  it('matches by name, case-insensitively', () => {
    expect(filterNpcs(ros, 'mara').map((n) => n.id)).toEqual(['2']);
    expect(filterNpcs(ros, 'THORNE').map((n) => n.id)).toEqual(['1']);
  });

  it('matches by role', () => {
    expect(filterNpcs(ros, 'archiv').map((n) => n.id)).toEqual(['2']);
  });

  it('matches by disposition', () => {
    expect(filterNpcs(ros, 'hostile').map((n) => n.id)).toEqual(['3']);
    expect(filterNpcs(ros, 'ally').map((n) => n.id)).toEqual(['1', '2']);
  });

  it('returns nothing when no field matches', () => {
    expect(filterNpcs(ros, 'zzzz')).toHaveLength(0);
  });
});
