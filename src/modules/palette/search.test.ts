import { describe, it, expect } from 'vitest';
import { scoreItem, search, type PaletteItem } from './search';

const items: PaletteItem[] = [
  { id: 'npcs', label: 'NPC Roster', module: 'npcs', kind: 'open' },
  { id: 'et', label: 'Captain Eli Thorne', detail: 'Harbormaster', module: 'npcs', kind: 'editor' },
  { id: 'l1', label: 'Innsmouth', detail: 'A decaying fishing town', module: 'lore', kind: 'editor' },
  { id: 'q1', label: 'The Innsmouth Gold', detail: 'session note', module: 'notebook', kind: 'open' },
  { id: 'spawn-map', label: 'Spawn Battle Map window', module: 'map', kind: 'spawn' },
];

describe('scoreItem', () => {
  it('ranks exact > prefix > word-start > substring > detail', () => {
    expect(scoreItem(items[2], 'innsmouth')).toBe(100); // exact label
    expect(scoreItem(items[3], 'the')).toBe(80); // prefix
    expect(scoreItem(items[1], 'thorne')).toBe(60); // word-start
    expect(scoreItem(items[3], 'old')).toBe(40); // substring of label, not a word-start
    expect(scoreItem(items[1], 'harbor')).toBe(20); // detail only
  });

  it('returns 0 on no match and 1 on empty query', () => {
    expect(scoreItem(items[0], 'zzz')).toBe(0);
    expect(scoreItem(items[0], '')).toBe(1);
  });
});

describe('search', () => {
  it('filters and ranks by score then label', () => {
    const hits = search('innsmouth', items);
    expect(hits.map((h) => h.id)).toEqual(['l1', 'q1']);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('matches spawn actions and detail text', () => {
    expect(search('battle', items).map((h) => h.id)).toEqual(['spawn-map']);
    expect(search('decaying', items).map((h) => h.id)).toEqual(['l1']);
  });

  it('empty query returns everything (capped by limit)', () => {
    expect(search('', items)).toHaveLength(items.length);
    expect(search('', items, 2)).toHaveLength(2);
  });

  it('returns [] when nothing matches', () => {
    expect(search('xyzzy', items)).toEqual([]);
  });
});
