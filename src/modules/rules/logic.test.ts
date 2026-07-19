import { describe, it, expect } from 'vitest';
import {
  forSystem,
  byCategory,
  searchRules,
  searchAll,
  rulingsForRule,
  conflictsFor,
} from './logic';
import type { RuleEntry, Ruling } from './data';

function rule(p: Partial<RuleEntry> & Pick<RuleEntry, 'id' | 'term'>): RuleEntry {
  return {
    body: '',
    system: 'both',
    category: 'combat',
    aliases: [],
    tags: [],
    builtin: true,
    ...p,
  };
}

function ruling(p: Partial<Ruling> & Pick<Ruling, 'id' | 'title'>): Ruling {
  return {
    body: '',
    system: 'both',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    ...p,
  };
}

const entries: RuleEntry[] = [
  rule({ id: 'a', term: 'Advantage', body: 'Roll 2d20 take higher', system: 'dnd5e', aliases: ['adv'] }),
  rule({ id: 's', term: 'Sanity Loss', body: 'Roll a Sanity check', system: 'coc7e', category: 'sanity', tags: ['san'] }),
  rule({ id: 'c', term: 'Cover', body: 'Partial cover hinders ranged', system: 'both' }),
];

describe('forSystem', () => {
  it('includes system-specific + shared entries', () => {
    expect(forSystem(entries, 'dnd5e').map((e) => e.id)).toEqual(['a', 'c']);
    expect(forSystem(entries, 'coc7e').map((e) => e.id)).toEqual(['s', 'c']);
  });
});

describe('byCategory', () => {
  it('filters by category, passes through on null', () => {
    expect(byCategory(entries, 'sanity').map((e) => e.id)).toEqual(['s']);
    expect(byCategory(entries, null)).toHaveLength(3);
  });
});

describe('searchRules', () => {
  it('returns all sorted by term on empty query', () => {
    expect(searchRules('', entries).map((e) => e.term)).toEqual(['Advantage', 'Cover', 'Sanity Loss']);
  });

  it('floats pinned entries first on empty query', () => {
    const pinned = entries.map((e) => (e.id === 's' ? { ...e, pinned: true } : e));
    expect(searchRules('', pinned).map((e) => e.id)).toEqual(['s', 'a', 'c']);
  });

  it('ranks term matches above body-only matches', () => {
    expect(searchRules('cover', entries).map((e) => e.id)).toEqual(['c']);
    expect(searchRules('roll', entries).map((e) => e.id).sort()).toEqual(['a', 's']);
  });

  it('ranks start-of-term above mid-term', () => {
    const es = [rule({ id: 'x', term: 'Grapple' }), rule({ id: 'y', term: 'Ungrappled' })];
    expect(searchRules('grapple', es).map((e) => e.id)).toEqual(['x', 'y']);
  });

  it('matches aliases and tags', () => {
    expect(searchRules('adv', entries).map((e) => e.id)).toEqual(['a']);
    expect(searchRules('san', entries).map((e) => e.id)).toEqual(['s']);
  });

  it('returns [] when nothing matches', () => {
    expect(searchRules('xyzzy', entries)).toEqual([]);
  });
});

describe('searchAll', () => {
  const rulings: Ruling[] = [
    ruling({ id: 'r1', title: 'Cover from allies', ruleId: 'c', tags: ['cover'] }),
    ruling({ id: 'r2', title: 'Retired call', status: 'retired' }),
  ];

  it('unifies rules and active rulings, rules leading ties', () => {
    const hits = searchAll('cover', entries, rulings);
    expect(hits[0]).toEqual({ type: 'rule', rule: entries[2] });
    expect(hits.some((h) => h.type === 'ruling' && h.ruling.id === 'r1')).toBe(true);
  });

  it('excludes retired rulings', () => {
    const hits = searchAll('retired', entries, rulings);
    expect(hits).toHaveLength(0);
  });

  it('empty query lists all rules then active rulings', () => {
    const hits = searchAll('', entries, rulings);
    expect(hits.filter((h) => h.type === 'ruling')).toHaveLength(1);
    expect(hits.filter((h) => h.type === 'rule')).toHaveLength(3);
  });
});

describe('rulingsForRule', () => {
  it('returns active rulings for a rule, newest first', () => {
    const rulings: Ruling[] = [
      ruling({ id: 'old', title: 'Old', ruleId: 'c', createdAt: '2026-01-01T00:00:00.000Z' }),
      ruling({ id: 'new', title: 'New', ruleId: 'c', createdAt: '2026-06-01T00:00:00.000Z' }),
      ruling({ id: 'gone', title: 'Gone', ruleId: 'c', status: 'retired' }),
      ruling({ id: 'other', title: 'Other', ruleId: 'a' }),
    ];
    expect(rulingsForRule(rulings, 'c').map((r) => r.id)).toEqual(['new', 'old']);
  });
});

describe('conflictsFor', () => {
  const rulings: Ruling[] = [ruling({ id: 'r1', title: 'Cover call', ruleId: 'c' })];

  it('flags an existing active ruling on the same rule', () => {
    expect(conflictsFor(rulings, { ruleId: 'c' }).map((r) => r.id)).toEqual(['r1']);
  });

  it('excludes self when editing', () => {
    expect(conflictsFor(rulings, { id: 'r1', ruleId: 'c' })).toEqual([]);
  });

  it('no ruleId → no conflict', () => {
    expect(conflictsFor(rulings, {})).toEqual([]);
  });
});
