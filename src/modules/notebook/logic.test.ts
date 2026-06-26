import { describe, it, expect } from 'vitest';
import { parseTags, filterNotes, allTags, type Note } from './logic';

describe('parseTags', () => {
  it('extracts #tags lower-cased and de-duplicated', () => {
    expect(parseTags('The party met #Bandits at #bandits camp #Tavern')).toEqual([
      'bandits',
      'tavern',
    ]);
  });

  it('supports hyphen/underscore and returns [] when none', () => {
    expect(parseTags('#side-quest and #plot_thread')).toEqual(['side-quest', 'plot_thread']);
    expect(parseTags('no tags here')).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  it('ignores a bare # with no word', () => {
    expect(parseTags('a # b #real')).toEqual(['real']);
  });
});

const notes: Note[] = [
  { id: 'a', body: 'Met the innkeeper #tavern #npc', at: 3, tags: ['tavern', 'npc'] },
  { id: 'b', body: 'Ambushed on the road #combat', at: 2, tags: ['combat'] },
  { id: 'c', body: 'Bought rope at the tavern', at: 1, tags: [] },
];

describe('filterNotes', () => {
  it('filters by case-insensitive text', () => {
    expect(filterNotes(notes, 'TAVERN').map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('filters by exact tag', () => {
    expect(filterNotes(notes, '', 'combat').map((n) => n.id)).toEqual(['b']);
  });

  it('AND-combines text and tag', () => {
    expect(filterNotes(notes, 'met', 'tavern').map((n) => n.id)).toEqual(['a']);
  });

  it('returns all when filters empty', () => {
    expect(filterNotes(notes, '   ', undefined)).toHaveLength(3);
  });
});

describe('allTags', () => {
  it('lists distinct tags sorted', () => {
    expect(allTags(notes)).toEqual(['combat', 'npc', 'tavern']);
  });
});
