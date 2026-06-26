import { describe, it, expect } from 'vitest';
import { aggregate, searchArchive, type SessionLog } from './logic';
import type { Note } from '../notebook/logic';

const notes: Note[] = [
  { id: 'n1', body: 'Met the innkeeper #tavern', at: 100, tags: ['tavern'] },
  { id: 'n2', body: 'Found a strange coin', at: 300, tags: [] },
];
const sessions: SessionLog[] = [
  { id: 's1', title: 'Session 1: Arrival', at: 200, summary: 'Party reaches Innsmouth' },
  { id: 's2', title: 'Session 2: The Reef', at: 50 },
];

describe('aggregate', () => {
  it('merges notes + sessions newest-first with source tags', () => {
    const all = aggregate(notes, sessions);
    expect(all.map((e) => e.id)).toEqual(['note-n2', 'session-s1', 'note-n1', 'session-s2']);
    expect(all.find((e) => e.id === 'session-s1')?.source).toBe('session');
    expect(all.find((e) => e.id === 'session-s1')?.text).toContain('Innsmouth');
  });

  it('handles empty inputs', () => {
    expect(aggregate([], [])).toEqual([]);
  });
});

describe('searchArchive', () => {
  const all = aggregate(notes, sessions);

  it('matches text across sources', () => {
    expect(searchArchive('innsmouth', all).map((e) => e.id)).toEqual(['session-s1']);
    expect(searchArchive('coin', all).map((e) => e.id)).toEqual(['note-n2']);
  });

  it('matches tags', () => {
    expect(searchArchive('tavern', all).map((e) => e.id)).toEqual(['note-n1']);
  });

  it('empty query returns all, no match returns []', () => {
    expect(searchArchive('  ', all)).toHaveLength(4);
    expect(searchArchive('zzz', all)).toEqual([]);
  });
});
