import { describe, it, expect } from 'vitest';
import { filterNpcs, queryNpcs, dispositionCounts } from './roster';
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

  it('matches a bilingual name in either language', () => {
    const bi: Npc[] = [
      { id: '9', name: { en: 'Mummy', pl: 'Mumia' }, role: '', disposition: 'hostile' },
    ];
    expect(filterNpcs(bi, 'mumia')).toHaveLength(1);
    expect(filterNpcs(bi, 'mummy')).toHaveLength(1);
  });
});

describe('queryNpcs', () => {
  it('keeps every disposition when disp is "all"', () => {
    expect(queryNpcs(ros, '', 'all')).toHaveLength(3);
  });

  it('filters to a single disposition', () => {
    expect(queryNpcs(ros, '', 'ally').map((n) => n.id)).toEqual(['1', '2']);
    expect(queryNpcs(ros, '', 'hostile').map((n) => n.id)).toEqual(['3']);
  });

  it('composes text query with disposition', () => {
    expect(queryNpcs(ros, 'mara', 'ally').map((n) => n.id)).toEqual(['2']);
    // Text matches an ally, but the hostile filter excludes it.
    expect(queryNpcs(ros, 'mara', 'hostile')).toHaveLength(0);
  });
});

describe('dispositionCounts', () => {
  it('counts total and per-disposition', () => {
    expect(dispositionCounts(ros)).toEqual({ all: 3, ally: 2, neutral: 0, hostile: 1 });
  });
});
