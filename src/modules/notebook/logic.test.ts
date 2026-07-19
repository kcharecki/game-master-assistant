import { describe, it, expect } from 'vitest';
import {
  parseTags,
  filterNotes,
  allTags,
  activeNotes,
  groupBySession,
  renameTagInBody,
  renameTag,
  hasTodos,
  toggleTodo,
  openTodos,
  linkTargets,
  parseMentions,
  escapeHtml,
  renderMarkdown,
  highlight,
  relativeShort,
  sessionGapHours,
  TEMPLATES,
  type Note,
} from './logic';

const mk = (over: Partial<Note> = {}): Note => ({
  id: crypto.randomUUID(),
  body: '',
  at: 0,
  tags: [],
  ...over,
});

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
  mk({ id: 'a', body: 'Met the innkeeper #tavern #npc', at: 3, tags: ['tavern', 'npc'] }),
  mk({ id: 'b', body: 'Ambushed on the road #combat', at: 2, tags: ['combat'] }),
  mk({ id: 'c', body: 'Bought rope at the tavern', at: 1, tags: [] }),
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

  it('excludes archived notes', () => {
    const withArchived = [...notes, mk({ id: 'z', body: 'gone #combat', at: 4, tags: ['combat'], archived: true })];
    expect(filterNotes(withArchived, '', 'combat').map((n) => n.id)).toEqual(['b']);
  });
});

describe('activeNotes', () => {
  it('drops archived notes', () => {
    const list = [mk({ id: 'x' }), mk({ id: 'y', archived: true })];
    expect(activeNotes(list).map((n) => n.id)).toEqual(['x']);
  });
});

describe('allTags', () => {
  it('lists distinct tags sorted, active only', () => {
    expect(allTags(notes)).toEqual(['combat', 'npc', 'tavern']);
  });
});

describe('groupBySession', () => {
  const H = 60 * 60 * 1000;
  it('splits on a > gap and numbers oldest = 1', () => {
    const list = [
      mk({ id: 's1a', at: 0 }),
      mk({ id: 's1b', at: 1 * H }),
      mk({ id: 's2a', at: 100 * H }),
    ];
    const groups = groupBySession(list);
    expect(groups.map((g) => g.index)).toEqual([2, 1]); // newest-first
    expect(groups[0].notes.map((n) => n.id)).toEqual(['s2a']);
    expect(groups[1].notes.map((n) => n.id)).toEqual(['s1b', 's1a']); // newest-first within
  });

  it('keeps close notes in one session', () => {
    const list = [mk({ at: 0 }), mk({ at: 1 * H }), mk({ at: 2 * H })];
    expect(groupBySession(list)).toHaveLength(1);
  });

  it('handles empty', () => {
    expect(groupBySession([])).toEqual([]);
  });
});

describe('renameTagInBody / renameTag', () => {
  it('rewrites tag occurrences case-insensitively', () => {
    expect(renameTagInBody('met #Tavern and #tavern', 'tavern', 'inn')).toBe('met #inn and #inn');
  });

  it('does not partially match longer tags', () => {
    expect(renameTagInBody('#tav and #tavern', 'tav', 'x')).toBe('#x and #tavern');
  });

  it('accepts leading # on args', () => {
    expect(renameTagInBody('#a', '#a', '#b')).toBe('#b');
  });

  it('merge (rename to existing tag) updates note tags and de-dupes', () => {
    const list = [mk({ body: 'x #combat #fight', tags: ['combat', 'fight'] })];
    const out = renameTag(list, 'fight', 'combat');
    expect(out[0].body).toBe('x #combat #combat');
    expect(out[0].tags).toEqual(['combat']);
  });

  it('leaves untouched notes referentially stable', () => {
    const n = mk({ body: 'no tags' });
    expect(renameTag([n], 'a', 'b')[0]).toBe(n);
  });
});

describe('todos', () => {
  const body = '- [ ] find idol\n- [x] talk to guard\nplain line';
  it('detects todos', () => {
    expect(hasTodos(body)).toBe(true);
    expect(hasTodos('nothing')).toBe(false);
  });

  it('toggles the n-th checkbox', () => {
    expect(toggleTodo(body, 0)).toBe('- [x] find idol\n- [x] talk to guard\nplain line');
    expect(toggleTodo(body, 1)).toBe('- [ ] find idol\n- [ ] talk to guard\nplain line');
  });

  it('out-of-range index is a no-op', () => {
    expect(toggleTodo(body, 9)).toBe(body);
  });

  it('lists open todos across notes', () => {
    const list = [mk({ body: '- [ ] a\n- [x] b' }), mk({ body: '- [ ] c' }), mk({ body: '- [ ] z', archived: true })];
    expect(openTodos(list)).toEqual(['a', 'c']);
  });
});

describe('linkTargets / parseMentions', () => {
  it('extracts distinct wikilink targets in order', () => {
    expect(linkTargets('see [[The Inn]] and [[Mara]] and [[the inn]]')).toEqual(['The Inn', 'Mara']);
    expect(linkTargets('none here')).toEqual([]);
  });

  it('extracts @mentions lower-cased de-duped', () => {
    expect(parseMentions('@Mara met @eli and @mara')).toEqual(['mara', 'eli']);
  });
});

describe('escapeHtml', () => {
  it('escapes dangerous characters', () => {
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;');
  });
});

describe('renderMarkdown', () => {
  it('renders bold, italic, code', () => {
    expect(renderMarkdown('**b** and *i* and `c`')).toBe(
      '<p><strong>b</strong> and <em>i</em> and <code>c</code></p>'
    );
  });

  it('renders unordered lists', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul class="md-list"><li>one</li><li>two</li></ul>');
  });

  it('renders todo checkboxes with indexes', () => {
    const out = renderMarkdown('- [ ] a\n- [x] b');
    expect(out).toContain('data-todo="0"');
    expect(out).toContain('data-todo="1" checked');
    expect(out).toContain('md-done');
  });

  it('is XSS-safe', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>'
    );
  });

  it('renders wikilinks when enabled', () => {
    const out = renderMarkdown('go to [[The Inn]]', { wikilink: true });
    expect(out).toContain('data-wiki="The Inn"');
    expect(out).toContain('>The Inn</a>');
  });

  it('leaves wikilinks as text when disabled', () => {
    expect(renderMarkdown('[[X]]')).toBe('<p>[[X]]</p>');
  });

  it('renders piped wikilinks with target + label split', () => {
    const out = renderMarkdown('see [[innsmouth|the town]]', { wikilink: true });
    expect(out).toContain('data-wiki="innsmouth"');
    expect(out).toContain('>the town</a>');
    expect(out).not.toContain('>innsmouth</a>');
  });

  it('falls back to target as label when the pipe half is empty', () => {
    const out = renderMarkdown('[[Mara|]]', { wikilink: true });
    expect(out).toContain('data-wiki="Mara"');
    expect(out).toContain('>Mara</a>');
  });

  it('renders #tags as spans', () => {
    expect(renderMarkdown('a #tag')).toContain('<span class="md-tag">#tag</span>');
  });

  it('renders ATX headings but leaves #tag lines as tags', () => {
    expect(renderMarkdown('## Encounter')).toBe('<h4 class="md-h">Encounter</h4>');
    expect(renderMarkdown('#prep')).toBe('<p><span class="md-tag">#prep</span></p>');
  });
});

describe('highlight', () => {
  it('wraps matches in <mark>', () => {
    expect(highlight('the Innkeeper spoke', 'inn')).toBe('the <mark>Inn</mark>keeper spoke');
  });

  it('escapes body and query', () => {
    expect(highlight('<b>', 'b')).toBe('&lt;<mark>b</mark>&gt;');
  });

  it('blank query returns escaped body unchanged', () => {
    expect(highlight('a & b', '  ')).toBe('a &amp; b');
  });
});

describe('relativeShort', () => {
  const now = 1_000_000_000_000;
  it('formats seconds/minutes/hours/days', () => {
    expect(relativeShort(now, now)).toBe('now');
    expect(relativeShort(now - 30_000, now)).toBe('now');
    expect(relativeShort(now - 5 * 60_000, now)).toBe('5m');
    expect(relativeShort(now - 3 * 3_600_000, now)).toBe('3h');
    expect(relativeShort(now - 5 * 86_400_000, now)).toBe('5d');
  });
});

describe('sessionGapHours', () => {
  const mk = (id: string, at: number): Note => ({ id, body: id, at, tags: [] });
  it('returns the gap to the older group, null for the oldest', () => {
    // groups are newest-first, notes within newest-first
    const groups = groupBySession([
      mk('a', 0),
      mk('b', 60 * 60 * 1000), // +1h → same session as a
      mk('c', 10 * 60 * 60 * 1000), // +9h from b → new session
    ]);
    expect(groups).toHaveLength(2);
    expect(sessionGapHours(groups, 0)).toBe(9); // newest group → 9h gap to older
    expect(sessionGapHours(groups, 1)).toBeNull(); // oldest group
  });
});

describe('TEMPLATES', () => {
  it('has distinct ids and non-empty bodies', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.body.length).toBeGreaterThan(0);
  });
});
