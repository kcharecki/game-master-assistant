import { describe, it, expect } from 'vitest';
import { forSystem, searchRules } from './logic';
import type { RuleEntry } from './data';

const entries: RuleEntry[] = [
  { id: 'a', term: 'Advantage', body: 'Roll 2d20 take higher', system: 'dnd5e' },
  { id: 's', term: 'Sanity Loss', body: 'Roll a Sanity check', system: 'coc7e' },
  { id: 'c', term: 'Cover', body: 'Partial cover hinders ranged', system: 'both' },
];

describe('forSystem', () => {
  it('includes system-specific + shared entries', () => {
    expect(forSystem(entries, 'dnd5e').map((e) => e.id)).toEqual(['a', 'c']);
    expect(forSystem(entries, 'coc7e').map((e) => e.id)).toEqual(['s', 'c']);
  });
});

describe('searchRules', () => {
  it('returns all sorted by term on empty query', () => {
    expect(searchRules('', entries).map((e) => e.term)).toEqual(['Advantage', 'Cover', 'Sanity Loss']);
  });

  it('ranks term matches above body-only matches', () => {
    // "cover" is in Cover's term and Cover's body; "roll" is body-only for two.
    expect(searchRules('cover', entries).map((e) => e.id)).toEqual(['c']);
    expect(searchRules('roll', entries).map((e) => e.id).sort()).toEqual(['a', 's']);
  });

  it('returns [] when nothing matches', () => {
    expect(searchRules('xyzzy', entries)).toEqual([]);
  });
});
