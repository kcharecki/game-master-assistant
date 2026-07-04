export interface NoteContext {
  /** initiative round at save time, if a fight was running */
  round?: number;
  /** short label of the on-air broadcast content at save time */
  onAir?: string;
  /** in-world calendar date label at save time */
  ivDate?: string;
}

export interface Note {
  id: string;
  body: string;
  at: number;
  tags: string[];
  /** sticky-at-top flag */
  pinned?: boolean;
  /** soft-deleted — kept for undo, hidden from the default view */
  archived?: boolean;
  /** asset id of an attached image (see lib/db assetPut) */
  assetId?: string;
  /** best-effort snapshot of what was happening when the note was saved */
  ctx?: NoteContext;
}

const TAG_RE = /#([a-z0-9][a-z0-9_-]*)/gi;
const MENTION_RE = /@([a-z0-9][a-z0-9_'-]*)/gi;
const WIKILINK_RE = /\[\[([^\][]+)\]\]/g;

/**
 * Extract `#tags` from a note body — lower-cased and de-duplicated, order of
 * first appearance preserved. Pure — unit-tested, no DOM.
 */
export function parseTags(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Only notes shown in the default view: not archived. */
export function activeNotes(notes: Note[]): Note[] {
  return notes.filter((n) => !n.archived);
}

/**
 * Filter notes by free text and/or an active tag. Text match is
 * case-insensitive against the body; tag match is exact (case-insensitive).
 * Both filters are AND-combined; empty filters pass everything. Archived notes
 * are excluded.
 */
export function filterNotes(notes: Note[], query: string, tag?: string): Note[] {
  const q = query.trim().toLowerCase();
  const t = tag?.trim().toLowerCase();
  return activeNotes(notes).filter((n) => {
    const textOk = !q || n.body.toLowerCase().includes(q);
    const tagOk = !t || n.tags.includes(t);
    return textOk && tagOk;
  });
}

/** All distinct tags across active notes, sorted alphabetically. */
export function allTags(notes: Note[]): string[] {
  const set = new Set<string>();
  for (const n of activeNotes(notes)) for (const tag of n.tags) set.add(tag);
  return [...set].sort();
}

// --- Sessions ---------------------------------------------------------------

export interface SessionGroup {
  /** 1-based session number, oldest = 1 */
  index: number;
  /** epoch ms of the first note in the group */
  startAt: number;
  notes: Note[];
}

/** Default gap that starts a new session bucket: 6 hours. */
export const SESSION_GAP_MS = 6 * 60 * 60 * 1000;

/**
 * Bucket notes into sessions using a simple gap rule: notes sorted by time; a
 * gap larger than `gapMs` between consecutive notes starts a new session.
 * Returns groups NEWEST-session-first, and notes WITHIN each group newest-first.
 * Session `index` numbers oldest = 1 so the label stays stable as new notes
 * arrive. Pure — unit-tested.
 */
export function groupBySession(notes: Note[], gapMs = SESSION_GAP_MS): SessionGroup[] {
  const sorted = [...notes].sort((a, b) => a.at - b.at);
  const buckets: Note[][] = [];
  for (const n of sorted) {
    const cur = buckets[buckets.length - 1];
    if (!cur || n.at - cur[cur.length - 1].at > gapMs) buckets.push([n]);
    else cur.push(n);
  }
  const groups = buckets.map((b, i) => ({
    index: i + 1,
    startAt: b[0].at,
    notes: [...b].sort((a, b2) => b2.at - a.at),
  }));
  return groups.reverse();
}

/**
 * Compact relative age of a timestamp: `now`, `2m`, `3h`, `5d`. Used for the
 * per-note age chip in the widget stream and Editor timeline. Pure.
 */
export function relativeShort(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Gap in hours between a session group's first note and the previous (older)
 * group's last note — drives the "6h gap → new" divider in the Editor timeline.
 * Returns null for the oldest group. Pure.
 */
export function sessionGapHours(groups: SessionGroup[], i: number): number | null {
  // groups are newest-first; the older neighbour is at i+1.
  const older = groups[i + 1];
  if (!older) return null;
  // newest note of the older group → the gap that started this session
  const prevLast = Math.max(...older.notes.map((n) => n.at));
  const curFirst = groups[i].startAt;
  return Math.round((curFirst - prevLast) / (60 * 60 * 1000));
}

// --- Tag management ---------------------------------------------------------

/**
 * Rewrite `#from` tags to `#to` in a body (case-insensitive, preserving the
 * leading `#`). `to` is lower-cased and stripped of a leading `#`. Used by
 * rename and merge. Pure — unit-tested.
 */
export function renameTagInBody(body: string, from: string, to: string): string {
  const f = from.replace(/^#/, '').toLowerCase();
  const dest = to.replace(/^#/, '').toLowerCase();
  if (!f) return body;
  const re = new RegExp(`#${escapeRegExp(f)}\\b`, 'gi');
  return body.replace(re, `#${dest}`);
}

/** Apply a tag rename/merge across a list of notes, returning new notes. */
export function renameTag(notes: Note[], from: string, to: string): Note[] {
  return notes.map((n) => {
    const body = renameTagInBody(n.body, from, to);
    if (body === n.body) return n;
    return { ...n, body, tags: parseTags(body) };
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- TODO checkboxes --------------------------------------------------------

/** True if a body contains at least one `- [ ]` / `- [x]` checkbox line. */
export function hasTodos(body: string): boolean {
  return /^[ \t]*[-*] \[[ xX]\]/m.test(body);
}

/**
 * Toggle the n-th checkbox (0-based, in document order) between `[ ]` and `[x]`.
 * Returns the rewritten body unchanged if the index is out of range. Pure.
 */
export function toggleTodo(body: string, index: number): string {
  let i = 0;
  return body.replace(/^([ \t]*[-*] )\[([ xX])\]/gm, (full, prefix: string, mark: string) => {
    if (i++ !== index) return full;
    const next = mark.trim() === '' ? 'x' : ' ';
    return `${prefix}[${next}]`;
  });
}

/** Open (unchecked) TODO lines across notes, trimmed of the `- [ ]` marker. */
export function openTodos(notes: Note[]): string[] {
  const out: string[] = [];
  for (const n of activeNotes(notes)) {
    for (const m of n.body.matchAll(/^[ \t]*[-*] \[ \]\s*(.+)$/gm)) {
      out.push(m[1].trim());
    }
  }
  return out;
}

// --- Wikilinks --------------------------------------------------------------

/** Distinct `[[wikilink]]` targets in a body, in order of first appearance. */
export function linkTargets(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(WIKILINK_RE)) {
    const name = m[1].trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** @npc-style mentions in a body (lower-cased, de-duplicated). */
export function parseMentions(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

// --- Markdown rendering -----------------------------------------------------

/** Escape HTML so untrusted note text can't inject markup. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderOptions {
  /** if given, `[[link]]` becomes an <a> with this data-attr for click routing */
  wikilink?: boolean;
}

/**
 * Tiny, XSS-safe markdown → HTML renderer. Supports: bold (`**`), italic
 * (`*`/`_`), inline code (`` ` ``), unordered lists (`- `/`* `), TODO
 * checkboxes (`- [ ]`/`- [x]`), `#tags`, `[[wikilinks]]`. Everything is escaped
 * first; only our own tags are re-introduced. Pure — unit-tested.
 *
 * Checkbox lines get `data-todo="N"` (document order) so the UI can wire toggles.
 */
export function renderMarkdown(body: string, opts: RenderOptions = {}): string {
  const lines = body.split('\n');
  const html: string[] = [];
  let listOpen = false;
  let todoIndex = 0;

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  for (const raw of lines) {
    // ATX heading: `#`..`######` followed by a space. `#tag` (no space) is not
    // a heading and falls through to inline tag styling.
    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      html.push(`<h4 class="md-h">${inline(heading[2], opts)}</h4>`);
      continue;
    }
    const todo = raw.match(/^[ \t]*[-*] \[([ xX])\]\s?(.*)$/);
    if (todo) {
      if (!listOpen) {
        html.push('<ul class="md-list">');
        listOpen = true;
      }
      const checked = todo[1].trim() !== '';
      const idx = todoIndex++;
      html.push(
        `<li class="md-todo"><input type="checkbox" data-todo="${idx}"${checked ? ' checked' : ''} /> <span${checked ? ' class="md-done"' : ''}>${inline(todo[2], opts)}</span></li>`
      );
      continue;
    }
    const li = raw.match(/^[ \t]*[-*]\s+(.*)$/);
    if (li) {
      if (!listOpen) {
        html.push('<ul class="md-list">');
        listOpen = true;
      }
      html.push(`<li>${inline(li[1], opts)}</li>`);
      continue;
    }
    closeList();
    if (raw.trim() === '') continue;
    html.push(`<p>${inline(raw, opts)}</p>`);
  }
  closeList();
  return html.join('');
}

/** Inline span formatting on already line-split, not-yet-escaped text. */
function inline(text: string, opts: RenderOptions): string {
  let s = escapeHtml(text);
  // inline code first (its content is left literal)
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => `<code>${c}</code>`);
  // bold then italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
  // wikilinks — content was escaped so brackets survive as literal chars
  if (opts.wikilink) {
    s = s.replace(/\[\[([^\][]+)\]\]/g, (_m, name: string) => {
      const label = name.trim();
      return `<a class="md-wiki" data-wiki="${escapeAttr(label)}" href="#">${label}</a>`;
    });
  }
  // @npc mentions
  s = s.replace(/(^|\s)@([a-z0-9][a-z0-9_'-]*)/gi, '$1<span class="md-npc">@$2</span>');
  // #tags
  s = s.replace(/(^|\s)#([a-z0-9][a-z0-9_-]*)/gi, '$1<span class="md-tag">#$2</span>');
  return s;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

// --- Search highlight -------------------------------------------------------

/**
 * Escape `body` and wrap every case-insensitive occurrence of `query` in
 * `<mark>`. Safe: the whole body is escaped first; only `<mark>` is added.
 * Empty/blank query returns the plain escaped body. Pure — unit-tested.
 */
export function highlight(body: string, query: string): string {
  const q = query.trim();
  const escaped = escapeHtml(body);
  if (!q) return escaped;
  const re = new RegExp(escapeRegExp(escapeHtml(q)), 'gi');
  return escaped.replace(re, (m) => `<mark>${m}</mark>`);
}

// --- Templates --------------------------------------------------------------

export interface Template {
  id: string;
  label: string;
  body: string;
}

/** One-click note skeletons inserted into the capture input. */
export const TEMPLATES: Template[] = [
  {
    id: 'session',
    label: 'Session prep',
    body: [
      '## Session prep',
      '- [ ] Recap last session',
      '- [ ] Opening scene: ',
      '- [ ] Key NPCs: ',
      '- [ ] Possible encounters: ',
      '- [ ] Loot / rewards: ',
      '#prep',
    ].join('\n'),
  },
  {
    id: 'encounter',
    label: 'Encounter',
    body: [
      '## Encounter: ',
      'Location: ',
      'Foes: ',
      'Tactics: ',
      'Reward: ',
      '#combat',
    ].join('\n'),
  },
  {
    id: 'loot',
    label: 'Loot',
    body: ['## Loot', '- Coin: ', '- Items: ', '- Magic: ', '#loot'].join('\n'),
  },
];
