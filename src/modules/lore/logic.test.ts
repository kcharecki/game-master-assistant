import { describe, it, expect } from 'vitest';
import {
  slugify,
  uniqueSlug,
  parseLinks,
  resolveLink,
  backlinks,
  unlinkedMentions,
  searchPages,
  migratePage,
  stripMarkup,
  type Page,
} from './logic';

const mk = (over: Partial<Page> = {}): Page => ({
  id: crypto.randomUUID(),
  slug: 'p',
  kind: 'concept',
  title: '',
  body: '',
  aliases: [],
  tags: [],
  playerSafe: false,
  updatedAt: 0,
  ...over,
});

describe('slugify', () => {
  it('lower-cases, spaces → dashes, strips junk, collapses/trims dashes', () => {
    expect(slugify('Esoteric Order')).toBe('esoteric-order');
    expect(slugify('  The  Marsh — Refinery!! ')).toBe('the-marsh-refinery');
    expect(slugify('Zażółć gęślą')).toBe('za-gl'); // diacritics dropped
  });

  it('empty → page', () => {
    expect(slugify('')).toBe('page');
    expect(slugify('!!!')).toBe('page');
  });
});

describe('uniqueSlug', () => {
  it('returns base when free', () => {
    expect(uniqueSlug('inn', new Set())).toBe('inn');
  });

  it('appends -2, -3… on collision (Set or array)', () => {
    expect(uniqueSlug('inn', ['inn'])).toBe('inn-2');
    expect(uniqueSlug('inn', new Set(['inn', 'inn-2']))).toBe('inn-3');
  });
});

describe('parseLinks', () => {
  it('parses plain and piped links; label defaults to target', () => {
    expect(parseLinks('go to [[Innsmouth]] via [[refinery|the Refinery]]')).toEqual([
      { target: 'Innsmouth', label: 'Innsmouth' },
      { target: 'refinery', label: 'the Refinery' },
    ]);
  });

  it('trims and de-dupes by lower-cased target, first spelling wins', () => {
    expect(parseLinks('[[ Inn ]] and [[inn|home]]')).toEqual([{ target: 'Inn', label: 'Inn' }]);
  });

  it('ignores empty targets and returns [] when none', () => {
    expect(parseLinks('[[ | x ]] plain')).toEqual([]);
    expect(parseLinks('nothing here')).toEqual([]);
  });
});

describe('resolveLink', () => {
  const pages: Page[] = [
    mk({ id: 'inn', slug: 'innsmouth', title: { en: 'Innsmouth', pl: 'Innsmouth' }, aliases: ['The Town'], updatedAt: 1 }),
    mk({ id: 'ord', slug: 'esoteric-order', title: { en: 'Esoteric Order', pl: 'Ezoteryczny Zakon' }, updatedAt: 2 }),
  ];

  it('resolves by slug', () => {
    expect(resolveLink(pages, 'innsmouth')).toBe('inn');
  });

  it('resolves by EN title and PL title (case-insensitive)', () => {
    expect(resolveLink(pages, 'esoteric order')).toBe('ord');
    expect(resolveLink(pages, 'Ezoteryczny Zakon')).toBe('ord');
  });

  it('resolves by alias', () => {
    expect(resolveLink(pages, 'the town')).toBe('inn');
  });

  it('returns undefined for a dangling target', () => {
    expect(resolveLink(pages, 'Nowhere')).toBeUndefined();
    expect(resolveLink(pages, '   ')).toBeUndefined();
  });

  it('tie-breaks a title collision by most recent updatedAt', () => {
    const dup: Page[] = [
      mk({ id: 'old', slug: 'a', title: 'Shadow', updatedAt: 5 }),
      mk({ id: 'new', slug: 'b', title: 'Shadow', updatedAt: 9 }),
    ];
    expect(resolveLink(dup, 'shadow')).toBe('new');
  });

  it('prefers a slug match over a title match', () => {
    const p: Page[] = [
      mk({ id: 'a', slug: 'moon', title: 'Sun', updatedAt: 1 }),
      mk({ id: 'b', slug: 'sun', title: 'Moon', updatedAt: 9 }),
    ];
    expect(resolveLink(p, 'moon')).toBe('a');
  });
});

describe('backlinks', () => {
  const pages: Page[] = [
    mk({ id: 'inn', slug: 'innsmouth', title: { en: 'Innsmouth', pl: 'Innsmouth' }, updatedAt: 3 }),
    mk({ id: 'ord', slug: 'order', title: { en: 'Esoteric Order', pl: 'Ezoteryczny Zakon' }, body: { en: 'Supplants [[Innsmouth]].', pl: 'Wypiera [[innsmouth]].' }, updatedAt: 2 }),
    mk({ id: 'lone', slug: 'lone', title: 'Lonely', body: 'no links', updatedAt: 1 }),
  ];

  it('lists pages whose links resolve to the target, across localized titles', () => {
    expect(backlinks(pages, 'inn')).toEqual(['ord']);
  });

  it('never includes self and returns [] for unknown id', () => {
    expect(backlinks(pages, 'lone')).toEqual([]);
    expect(backlinks(pages, 'nope')).toEqual([]);
  });
});

describe('unlinkedMentions', () => {
  it('finds a plain-text mention across locales but excludes already-linked pages', () => {
    const pages: Page[] = [
      mk({ id: 'inn', slug: 'innsmouth', title: { en: 'Innsmouth' }, aliases: ['Marsh'], updatedAt: 3 }),
      mk({ id: 'mentions', slug: 'diary', title: 'Diary', body: { en: 'We fled Innsmouth at dawn.', pl: 'Uciekliśmy z Marsh.' } }),
      mk({ id: 'linked', slug: 'note', title: 'Note', body: 'A page about [[Innsmouth]].' }),
    ];
    expect(unlinkedMentions(pages, 'inn')).toEqual(['mentions']);
  });

  it('matches whole words only and never self', () => {
    const pages: Page[] = [
      mk({ id: 'inn', slug: 'inn', title: 'Inn', updatedAt: 1 }),
      mk({ id: 'x', slug: 'x', title: 'X', body: 'the Innkeeper spoke' }), // "Inn" inside "Innkeeper" is not whole-word
      mk({ id: 'y', slug: 'y', title: 'Y', body: 'met at the Inn' }),
    ];
    expect(unlinkedMentions(pages, 'inn')).toEqual(['y']);
  });

  it('detects a Polish-titled mention flanked by non-ASCII punctuation (Unicode boundary)', () => {
    const pages: Page[] = [
      mk({ id: 'z', slug: 'zazolc', title: { pl: 'Zażółć' }, updatedAt: 2 }),
      // em-dash + ellipsis directly against the diacritic word — ASCII \b would miss it
      mk({ id: 'diary', slug: 'diary', title: 'Diary', body: { pl: 'Miasto—Zażółć…—upadło.' } }),
      // diacritic inside a longer word must NOT count as a whole-word hit
      mk({ id: 'nope', slug: 'nope', title: 'Nope', body: { pl: 'Zażółćże się teraz.' } }),
    ];
    expect(unlinkedMentions(pages, 'z')).toEqual(['diary']);
  });

  it('returns [] for unknown target', () => {
    expect(unlinkedMentions([mk()], 'nope')).toEqual([]);
  });
});

describe('searchPages', () => {
  const pages: Page[] = [
    mk({ id: 'inn', slug: 'innsmouth', title: { en: 'Innsmouth', pl: 'Innsmouth' }, body: { en: 'A decaying town.', pl: 'Rozpadające się miasto.' }, tags: ['town'], kind: 'place', updatedAt: 5 }),
    mk({ id: 'ord', slug: 'order', title: { en: 'Esoteric Order', pl: 'Ezoteryczny Zakon' }, summary: { en: 'A cult in Innsmouth.' }, aliases: ['The Order'], kind: 'faction', updatedAt: 4 }),
    mk({ id: 'pin', slug: 'ref', title: 'Refinery', body: 'gold', kind: 'place', pinned: true, updatedAt: 1 }),
  ];

  it('empty query returns all, pinned first then updatedAt desc', () => {
    expect(searchPages(pages, '').map((p) => p.id)).toEqual(['pin', 'inn', 'ord']);
  });

  it('ranks title-hit above body-hit', () => {
    // "Innsmouth" hits inn.title (rank 3) and ord.summary (rank 1)
    expect(searchPages(pages, 'innsmouth').map((p) => p.id)).toEqual(['inn', 'ord']);
  });

  it('ranks alias/tag hits above body hits', () => {
    const p: Page[] = [
      mk({ id: 'bodyhit', slug: 'a', title: 'A', body: 'mentions cult here', updatedAt: 9 }),
      mk({ id: 'aliashit', slug: 'b', title: 'B', aliases: ['cult'], updatedAt: 1 }),
    ];
    expect(searchPages(p, 'cult').map((x) => x.id)).toEqual(['aliashit', 'bodyhit']);
  });

  it('matches across the Polish locale', () => {
    expect(searchPages(pages, 'miasto').map((p) => p.id)).toEqual(['inn']);
  });

  it('applies kind and tag filters', () => {
    expect(searchPages(pages, '', { kind: 'faction' }).map((p) => p.id)).toEqual(['ord']);
    expect(searchPages(pages, '', { tag: 'town' }).map((p) => p.id)).toEqual(['inn']);
  });
});

describe('stripMarkup', () => {
  it('unwraps plain and piped wiki links', () => {
    expect(stripMarkup('See [[Marsh Refinery]] and [[esoteric-order|the Order]].')).toBe(
      'See Marsh Refinery and the Order.'
    );
  });

  it('drops bold/italic/code emphasis markers, keeping the words', () => {
    expect(stripMarkup('A **bold** and *italic* and _under_ and `code` word.')).toBe(
      'A bold and italic and under and code word.'
    );
  });

  it('removes leading heading and list markers per line', () => {
    expect(stripMarkup('## Title\n- one\n- two')).toBe('Title\none\ntwo');
  });

  it('strips #tag and @npc marker chars but keeps the word', () => {
    expect(stripMarkup('Meet @Zadok about the #ritual tonight.')).toBe(
      'Meet Zadok about the ritual tonight.'
    );
  });

  it('collapses runs of blank lines but preserves paragraph breaks', () => {
    expect(stripMarkup('First para.\n\n\n\nSecond para.')).toBe('First para.\n\nSecond para.');
  });

  it('handles Polish text with a piped link and a mention', () => {
    expect(
      stripMarkup('Zobacz [[Marsh Refinery|Rafinerię]], porozmawiaj z @Zażółć o **złocie**.')
    ).toBe('Zobacz Rafinerię, porozmawiaj z Zażółć o złocie.');
  });

  it('keeps a literal numeric marker like "issue #5" (only letter-led tags strip)', () => {
    expect(stripMarkup('Fix issue #5 and the #ritual.')).toBe('Fix issue #5 and the ritual.');
  });

  it('returns empty string for empty input', () => {
    expect(stripMarkup('')).toBe('');
  });
});

describe('migratePage', () => {
  it('migrates the old {id,title,body} shape into a full Page', () => {
    const taken = new Set<string>();
    const p = migratePage({ id: 'innsmouth', title: 'Innsmouth', body: 'A town.' }, taken);
    expect(p.id).toBe('innsmouth');
    expect(p.slug).toBe('innsmouth');
    expect(p.title).toBe('Innsmouth'); // plain string LocalizedText
    expect(p.body).toBe('A town.');
    expect(p.kind).toBe('concept');
    expect(p.aliases).toEqual([]);
    expect(p.tags).toEqual([]);
    expect(p.playerSafe).toBe(false);
    expect(p.updatedAt).toBe(0);
    expect(taken.has('innsmouth')).toBe(true);
  });

  it('generates unique slugs and mutates the taken set', () => {
    const taken = new Set<string>();
    const a = migratePage({ title: 'The Order' }, taken);
    const b = migratePage({ title: 'The Order' }, taken);
    expect(a.slug).toBe('the-order');
    expect(b.slug).toBe('the-order-2');
  });

  it('preserves an existing slug (rename-proof) and valid new fields', () => {
    const taken = new Set<string>();
    const p = migratePage(
      { id: 'x', slug: 'old-slug', title: { en: 'New Name', pl: 'Nowa' }, kind: 'faction', tags: ['t'], playerSafe: true, pinned: true, updatedAt: 42 },
      taken
    );
    expect(p.slug).toBe('old-slug');
    expect(p.kind).toBe('faction');
    expect(p.playerSafe).toBe(true);
    expect(p.pinned).toBe(true);
    expect(p.updatedAt).toBe(42);
  });

  it('defaults an unknown kind to concept and mints an id when absent', () => {
    const p = migratePage({ title: 'X', kind: 'nonsense' }, new Set());
    expect(p.kind).toBe('concept');
    expect(p.id).toBeTruthy();
  });
});
