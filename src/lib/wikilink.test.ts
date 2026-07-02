import { describe, it, expect } from 'vitest';
import { resolveWikilink } from './wikilink';

const lore = [
  { id: 'innsmouth', name: 'Innsmouth' },
  { id: 'order', name: 'Esoteric Order' },
];
const npcs = [
  { id: 'et', name: 'Captain Eli Thorne' },
  { id: 'innkeeper', name: 'Innsmouth Innkeeper' },
];

describe('resolveWikilink', () => {
  it('resolves an exact lore title', () => {
    expect(resolveWikilink('Innsmouth', lore, npcs)).toEqual({ module: 'lore', id: 'innsmouth' });
  });

  it('is case-insensitive', () => {
    expect(resolveWikilink('esoteric order', lore, npcs)).toEqual({ module: 'lore', id: 'order' });
  });

  it('resolves an NPC by exact name when no lore matches', () => {
    expect(resolveWikilink('Captain Eli Thorne', lore, npcs)).toEqual({ module: 'npcs', id: 'et' });
  });

  it('prefers an exact lore match over an NPC substring', () => {
    // "Innsmouth" is an exact lore page and a substring of an NPC name
    expect(resolveWikilink('Innsmouth', lore, npcs)).toEqual({ module: 'lore', id: 'innsmouth' });
  });

  it('falls back to a substring match', () => {
    expect(resolveWikilink('Thorne', lore, npcs)).toEqual({ module: 'npcs', id: 'et' });
  });

  it('returns null for empty or unmatched names', () => {
    expect(resolveWikilink('', lore, npcs)).toBeNull();
    expect(resolveWikilink('nobody', lore, npcs)).toBeNull();
  });
});
