import { describe, it, expect } from 'vitest';
import { parseLinks, resolveLink, backlinks, type Page } from './logic';

describe('parseLinks', () => {
  it('extracts [[links]] and trims them', () => {
    expect(parseLinks('See [[ Innsmouth ]] and [[Marsh Refinery]].')).toEqual([
      'Innsmouth',
      'Marsh Refinery',
    ]);
  });

  it('de-duplicates case-insensitively, keeping first spelling', () => {
    expect(parseLinks('[[Innsmouth]] then [[innsmouth]] again')).toEqual(['Innsmouth']);
  });

  it('ignores empty and returns [] when there are none', () => {
    expect(parseLinks('plain text [[   ]] no links')).toEqual([]);
    expect(parseLinks('')).toEqual([]);
  });
});

const pages: Page[] = [
  { id: 'a', title: 'Innsmouth', body: 'A decaying town near the [[Marsh Refinery]].' },
  { id: 'b', title: 'Marsh Refinery', body: 'Run by the [[Esoteric Order]]. Feeds [[Innsmouth]].' },
  { id: 'c', title: 'Esoteric Order', body: 'A cult.' },
];

describe('resolveLink', () => {
  it('resolves by case-insensitive title', () => {
    expect(resolveLink(pages, 'innsmouth')).toBe('a');
  });
  it('returns undefined for a dangling link', () => {
    expect(resolveLink(pages, 'Nowhere')).toBeUndefined();
  });
});

describe('backlinks', () => {
  it('lists pages that link to the target, excluding itself', () => {
    expect(backlinks(pages, 'a')).toEqual(['b']); // Marsh Refinery -> Innsmouth
    expect(backlinks(pages, 'b')).toEqual(['a']); // Innsmouth -> Marsh Refinery
    expect(backlinks(pages, 'c')).toEqual(['b']); // Marsh Refinery -> Esoteric Order
  });

  it('is empty when nobody links in', () => {
    const isolated: Page[] = [{ id: 'x', title: 'Lone', body: 'no links here' }];
    expect(backlinks(isolated, 'x')).toEqual([]);
  });

  it('is empty for an unknown id', () => {
    expect(backlinks(pages, 'zzz')).toEqual([]);
  });
});
