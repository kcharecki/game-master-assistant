import { describe, it, expect } from 'vitest';
import { loc, setLoc, locStrings, locEq } from './loc';

describe('loc', () => {
  it('returns a plain string in any language', () => {
    expect(loc('Mummy', 'en')).toBe('Mummy');
    expect(loc('Mummy', 'pl')).toBe('Mummy');
  });
  it('resolves the requested language, falling back to the other', () => {
    const v = { en: 'Mummy', pl: 'Mumia' };
    expect(loc(v, 'en')).toBe('Mummy');
    expect(loc(v, 'pl')).toBe('Mumia');
    expect(loc({ en: 'Only EN' }, 'pl')).toBe('Only EN');
    expect(loc(undefined, 'en')).toBe('');
  });
  it('treats an explicitly-empty variant as an intentional clear, not a fallback', () => {
    // Blanking the pl variant of a both-seeded value must render blank, not
    // resurrect the en variant (the "can't delete New NPC" bug).
    expect(loc({ en: 'New NPC', pl: '' }, 'pl')).toBe('');
    expect(loc({ en: 'New NPC', pl: '' }, 'en')).toBe('New NPC');
  });
});

describe('setLoc', () => {
  it('seeds both languages from a plain string, then overrides one', () => {
    expect(setLoc('Mummy', 'pl', 'Mumia')).toEqual({ en: 'Mummy', pl: 'Mumia' });
  });
  it('preserves the other language when editing an object', () => {
    expect(setLoc({ en: 'Mummy', pl: 'Mumia' }, 'en', 'The Mummy')).toEqual({
      en: 'The Mummy',
      pl: 'Mumia',
    });
  });
});

describe('locStrings / locEq', () => {
  it('lists every non-empty variant', () => {
    expect(locStrings({ en: 'Mummy', pl: 'Mumia' })).toEqual(['Mummy', 'Mumia']);
    expect(locStrings('Mummy')).toEqual(['Mummy']);
    expect(locStrings(undefined)).toEqual([]);
  });
  it('matches across languages, case-insensitively', () => {
    expect(locEq({ en: 'Mummy', pl: 'Mumia' }, 'mumia')).toBe(true);
    expect(locEq('Mummy', { pl: 'Mumia' })).toBe(false);
  });
});
