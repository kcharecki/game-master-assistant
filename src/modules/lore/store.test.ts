import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};
vi.mock('../../lib/db', () => ({
  kvGet: vi.fn(async (k: string) => store[k]),
  kvSet: vi.fn(async (k: string, v: unknown) => {
    store[k] = v;
  }),
  assetPut: vi.fn(async () => 'asset-1'),
  assetGet: vi.fn(async () => undefined),
  assetUrl: vi.fn(async () => undefined),
  assetDelete: vi.fn(async () => undefined),
}));

vi.mock('../../lib/stores/toast.svelte', () => ({
  toast: { undoable: vi.fn(), show: vi.fn() },
}));

import { lore } from './store.svelte';

// Reset to seed before each test (store is a singleton module instance).
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  lore.pages = [
    {
      id: 'innsmouth',
      slug: 'innsmouth',
      kind: 'place',
      title: { en: 'Innsmouth', pl: 'Innsmouth' },
      body: { en: 'See the [[Marsh Refinery]] and [[Esoteric Order]].', pl: 'Zobacz [[Marsh Refinery]].' },
      aliases: [],
      tags: ['town'],
      playerSafe: true,
      updatedAt: 1,
    },
    {
      id: 'refinery',
      slug: 'marsh-refinery',
      kind: 'place',
      title: { en: 'Marsh Refinery', pl: 'Rafineria Marsh' },
      body: 'Run by the [[Esoteric Order]].',
      aliases: [],
      tags: ['town'],
      playerSafe: false,
      updatedAt: 2,
    },
    {
      id: 'order',
      slug: 'esoteric-order',
      kind: 'faction',
      title: { en: 'Esoteric Order', pl: 'Ezoteryczny Zakon' },
      body: 'Supplanted the churches of [[Innsmouth]].',
      aliases: [],
      tags: ['faction'],
      playerSafe: true,
      updatedAt: 3,
    },
  ];
  lore.selectedId = 'innsmouth';
});

describe('add', () => {
  it('creates a page with a unique slug and selects it', () => {
    const a = lore.add('person', { en: 'Zadok' });
    expect(a.kind).toBe('person');
    expect(a.slug).toBe('zadok');
    expect(lore.selectedId).toBe(a.id);
    const b = lore.add('person', { en: 'Zadok' });
    expect(b.slug).toBe('zadok-2');
  });

  it('defaults kind to concept', () => {
    expect(lore.add().kind).toBe('concept');
  });
});

describe('update', () => {
  it('bumps updatedAt', () => {
    const before = lore.pages[0].updatedAt;
    lore.update('innsmouth', { tags: ['town', 'coastal'] });
    expect(lore.pages[0].updatedAt).toBeGreaterThan(before);
  });

  it('keeps the old title as an alias on rename but leaves the slug stable', () => {
    lore.update('innsmouth', { title: { en: 'New Innsmouth' } });
    expect(lore.pages[0].slug).toBe('innsmouth');
    expect(lore.pages[0].aliases).toContain('Innsmouth');
  });

  it('does not add an alias when the title is unchanged', () => {
    lore.update('innsmouth', { tags: [] });
    expect(lore.pages[0].aliases).toEqual([]);
  });
});

describe('setField', () => {
  it('sets one locale and preserves the other', () => {
    lore.setField('innsmouth', 'title', 'pl', 'Insmuth');
    expect(lore.pages[0].title).toEqual({ en: 'Innsmouth', pl: 'Insmuth' });
  });

  it('seeds a summary field that did not exist (only the edited locale)', () => {
    lore.setField('innsmouth', 'summary', 'en', 'A cursed port.');
    expect(lore.pages[0].summary).toEqual({ en: 'A cursed port.' });
  });
});

describe('remove + undo', () => {
  it('removes a page and restores it to its original position via the undo fn', async () => {
    const { toast } = await import('../../lib/stores/toast.svelte');
    lore.remove('refinery');
    expect(lore.pages.map((p) => p.id)).toEqual(['innsmouth', 'order']);
    // Grab the undo callback the store handed to toast.undoable and run it.
    const undoFn = (toast.undoable as unknown as { mock: { calls: [string, () => void][] } }).mock
      .calls.at(-1)![1];
    undoFn();
    expect(lore.pages.map((p) => p.id)).toEqual(['innsmouth', 'refinery', 'order']);
  });
});

describe('load', () => {
  it('migrates old-shape saved records', async () => {
    const { kvGet } = await import('../../lib/db');
    (kvGet as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce([
      { id: 'a', title: 'Old Town', body: 'Legacy body' },
    ]);
    await lore.load();
    expect(lore.pages).toHaveLength(1);
    expect(lore.pages[0].slug).toBe('old-town');
    expect(lore.pages[0].kind).toBe('concept');
    expect(lore.pages[0].title).toBe('Old Town');
    expect(lore.pages[0].playerSafe).toBe(false);
  });
});

describe('delegating helpers', () => {
  it('linksOf resolves targets', () => {
    const links = lore.linksOf('innsmouth');
    expect(links.map((l) => l.targetId)).toEqual(['refinery', 'order']);
  });

  it('backlinksOf finds pages linking in', () => {
    expect(lore.backlinksOf('order').map((p) => p.id).sort()).toEqual(['innsmouth', 'refinery']);
  });

  it('mentionsOf finds unlinked prose mentions', () => {
    lore.pages.push({
      id: 'diary',
      slug: 'diary',
      kind: 'item',
      title: 'Diary',
      body: 'We fled Innsmouth by night.',
      aliases: [],
      tags: [],
      playerSafe: false,
      updatedAt: 9,
    });
    expect(lore.mentionsOf('innsmouth').map((p) => p.id)).toEqual(['diary']);
  });

  it('search delegates to searchPages and returns live objects', () => {
    const res = lore.search('refinery');
    expect(res[0].id).toBe('refinery');
    expect(res[0]).toBe(lore.pages.find((p) => p.id === 'refinery'));
  });
});

describe('exportJSON / importJSON', () => {
  it('exportJSON emits a parseable wrapper with all pages', () => {
    const parsed = JSON.parse(lore.exportJSON());
    expect(parsed.pages).toHaveLength(3);
    expect(parsed.pages.map((p: { id: string }) => p.id)).toEqual(['innsmouth', 'refinery', 'order']);
  });

  it('roundtrips bilingual content through export -> replace import', () => {
    const json = lore.exportJSON();
    lore.importJSON(json, 'replace');
    expect(lore.pages).toHaveLength(3);
    expect(lore.pages[0].title).toEqual({ en: 'Innsmouth', pl: 'Innsmouth' });
    expect(lore.pages[0].body).toEqual({
      en: 'See the [[Marsh Refinery]] and [[Esoteric Order]].',
      pl: 'Zobacz [[Marsh Refinery]].',
    });
  });

  it('replace swaps the whole set and reselects the first page', () => {
    const json = JSON.stringify({ pages: [{ id: 'x', slug: 'x', title: 'X', body: '' }] });
    const res = lore.importJSON(json, 'replace');
    expect(res.imported).toBe(1);
    expect(lore.pages.map((p) => p.id)).toEqual(['x']);
    expect(lore.selectedId).toBe('x');
  });

  it('merge adds new pages and replaces matching slugs, keeping the rest', () => {
    const json = JSON.stringify({
      pages: [
        { id: 'new-inns', slug: 'innsmouth', title: 'Innsmouth Reborn', body: '' },
        { id: 'newbie', slug: 'newbie', title: 'Newbie', body: '' },
      ],
    });
    const res = lore.importJSON(json, 'merge');
    expect(res.imported).toBe(2);
    // innsmouth slug replaced (imported wins), refinery + order kept, newbie added.
    const bySlug = Object.fromEntries(lore.pages.map((p) => [p.slug, p.id]));
    expect(bySlug['innsmouth']).toBe('new-inns');
    expect(bySlug['marsh-refinery']).toBe('refinery');
    expect(bySlug['newbie']).toBe('newbie');
    expect(lore.pages).toHaveLength(4);
  });

  it('returns an error and changes nothing on bad JSON', () => {
    const res = lore.importJSON('{ bad ]', 'replace');
    expect(res.error).toBeTruthy();
    expect(res.imported).toBe(0);
    expect(lore.pages).toHaveLength(3);
  });
});

describe('revealPayload', () => {
  it('returns a parchment text payload with markup stripped for players', () => {
    const p = lore.revealPayload('innsmouth', 'en', 'body');
    expect(p).toMatchObject({ kind: 'text', theme: 'parchment', title: 'Innsmouth' });
    expect(p).toHaveProperty('body');
    const body = (p as { body: string }).body;
    expect(body).toContain('Marsh Refinery'); // link unwrapped to plain text
    expect(body).not.toContain('[['); // no leftover markup for the raw <p>
  });

  it('sends an image payload (title as caption) when which=image and an imageId is set', () => {
    lore.pages[0].imageId = 'asset-9';
    expect(lore.revealPayload('innsmouth', 'en', 'image')).toEqual({
      kind: 'image',
      assetId: 'asset-9',
      caption: 'Innsmouth',
    });
  });

  it('falls back to a text payload when which=image but no imageId', () => {
    expect(lore.revealPayload('order', 'en', 'image')).toMatchObject({
      kind: 'text',
      theme: 'parchment',
      title: 'Esoteric Order',
    });
  });

  it('is null when the page is not player-safe', () => {
    expect(lore.revealPayload('refinery', 'en', 'body')).toBeNull();
  });

  it('is null for an unknown page', () => {
    expect(lore.revealPayload('nope', 'en', 'body')).toBeNull();
  });
});
