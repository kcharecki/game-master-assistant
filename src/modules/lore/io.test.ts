import { describe, it, expect } from 'vitest';
import { exportPages, parseImport, LORE_EXPORT_VERSION } from './io';
import type { Page } from './logic';

const sample: Page = {
  id: 'innsmouth',
  slug: 'innsmouth',
  kind: 'place',
  title: { en: 'Innsmouth', pl: 'Innsmouth' },
  summary: { en: 'A cursed port.', pl: 'Przeklęty port.' },
  body: { en: 'See [[Marsh Refinery]].', pl: 'Zobacz [[Rafineria Marsh]].' },
  secret: { en: 'The truth.', pl: 'Prawda.' },
  aliases: ['Old Innsmouth'],
  tags: ['town'],
  playerSafe: true,
  pinned: true,
  updatedAt: 42,
};

describe('exportPages', () => {
  it('produces a versioned, pretty wrapper with a no-blobs note', () => {
    const json = exportPages([sample]);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(LORE_EXPORT_VERSION);
    expect(typeof parsed.note).toBe('string');
    expect(parsed.pages).toHaveLength(1);
    expect(json).toContain('\n'); // pretty-printed
  });
});

describe('roundtrip', () => {
  it('export -> parse preserves bilingual content', () => {
    const { pages, error } = parseImport(exportPages([sample]));
    expect(error).toBeUndefined();
    expect(pages).toHaveLength(1);
    const p = pages[0];
    expect(p.title).toEqual({ en: 'Innsmouth', pl: 'Innsmouth' });
    expect(p.summary).toEqual({ en: 'A cursed port.', pl: 'Przeklęty port.' });
    expect(p.body).toEqual({ en: 'See [[Marsh Refinery]].', pl: 'Zobacz [[Rafineria Marsh]].' });
    expect(p.secret).toEqual({ en: 'The truth.', pl: 'Prawda.' });
    expect(p.aliases).toEqual(['Old Innsmouth']);
    expect(p.tags).toEqual(['town']);
    expect(p.playerSafe).toBe(true);
    expect(p.pinned).toBe(true);
    expect(p.slug).toBe('innsmouth');
  });
});

describe('parseImport', () => {
  it('returns an error (not a throw) on bad JSON', () => {
    const { pages, error } = parseImport('{ not json ]');
    expect(pages).toEqual([]);
    expect(error).toBeTruthy();
  });

  it('rejects a well-formed but wrong-shape object', () => {
    const { error } = parseImport('{"foo":123}');
    expect(error).toBeTruthy();
  });

  it('accepts a bare page array', () => {
    const { pages, error } = parseImport(JSON.stringify([{ title: 'Loose', body: 'x' }]));
    expect(error).toBeUndefined();
    expect(pages).toHaveLength(1);
  });

  it('migrates foreign / partial records into valid Pages', () => {
    const { pages } = parseImport(JSON.stringify({ pages: [{ title: 'Old Town', body: 'Legacy' }] }));
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe('old-town');
    expect(pages[0].kind).toBe('concept');
    expect(pages[0].playerSafe).toBe(false);
    expect(pages[0].id).toBeTruthy();
  });

  it('gives clashing imported slugs unique keys', () => {
    const { pages } = parseImport(
      JSON.stringify({ pages: [{ title: 'Dup' }, { title: 'Dup' }] })
    );
    expect(pages.map((p) => p.slug)).toEqual(['dup', 'dup-2']);
  });
});
