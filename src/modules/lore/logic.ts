import { loc, locStrings, type LocalizedText } from '../../lib/loc';

export type PageKind = 'place' | 'person' | 'faction' | 'item' | 'event' | 'creature' | 'concept';

/** Every kind a page can be, in canonical order (drives filters/labels). */
export const PAGE_KINDS: PageKind[] = [
  'place',
  'person',
  'faction',
  'item',
  'event',
  'creature',
  'concept',
];

export interface Page {
  id: string;
  /** stable kebab canonical key; links resolve to this (rename-proof) */
  slug: string;
  kind: PageKind;
  title: LocalizedText;
  summary?: LocalizedText;
  /** markdown */
  body: LocalizedText;
  /** GM-only; never revealed */
  secret?: LocalizedText;
  aliases: string[];
  tags: string[];
  imageId?: string;
  playerSafe: boolean;
  pinned?: boolean;
  updatedAt: number;
}

// Pipe-aware wiki-link: `[[target|label]]` or `[[target]]`.
const LINK_RE = /\[\[([^[\]]+)\]\]/g;

/**
 * Slugify a string into a stable kebab key: lower-cased, spaces → '-',
 * every char outside `[a-z0-9-]` dropped, runs of dashes collapsed, leading and
 * trailing dashes trimmed. An empty result becomes `page`. Pure.
 */
export function slugify(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || 'page';
}

/**
 * Return `base` if free, else the first of `base-2`, `base-3`… not already in
 * `taken`. Pure.
 */
export function uniqueSlug(base: string, taken: Set<string> | string[]): string {
  const set = taken instanceof Set ? taken : new Set(taken);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Flatten markdown/wiki markup to clean plain text for PLAYER display (the
 * broadcast page renders text bodies raw, so leftover `[[ ]]`/`**`/`#`/`@`
 * markers would show verbatim). `[[target|label]]`→`label`, `[[target]]`→
 * `target`; `**x**`/`*x*`/`_x_`/`` `x` ``→`x`; leading `- ` and `## ` markers
 * dropped; `#tag`→`tag`, `@npc`→`npc` (marker char removed, word kept);
 * runs of 3+ newlines collapse to one blank line (paragraph breaks kept).
 * Unicode-aware so Polish diacritics survive. Pure — unit-tested.
 */
export function stripMarkup(md: string): string {
  // Line-scoped: drop leading heading (`#`+) and list (`-`/`*`/`+`) markers.
  const lines = (md ?? '').split(/\r?\n/).map((line) =>
    line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*[-*+]\s+/, '')
  );
  let s = lines.join('\n');
  // Wiki links → label (piped) or target.
  s = s.replace(LINK_RE, (_m, inner: string) => {
    const pipe = inner.indexOf('|');
    return (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
  });
  // Inline code, then bold/italic emphasis.
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');
  // #tag / @npc → bare word (Unicode-aware; keeps Polish diacritics). Requires
  // a leading LETTER so literal numerics like "issue #5" keep their marker.
  s = s.replace(/(^|\s)[#@](\p{L}[\p{L}\p{N}_'-]*)/gu, '$1$2');
  // Collapse 3+ newlines to a single blank line; trim outer whitespace.
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

export interface ParsedLink {
  target: string;
  label: string;
}

/**
 * Extract wiki-links from a body — `[[target|label]]` and `[[target]]` (label
 * defaults to target). Both parts trimmed; de-duplicated by lower-cased target,
 * first spelling wins. Pure — unit-tested, no DOM.
 */
export function parseLinks(body: string): ParsedLink[] {
  const out: ParsedLink[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(LINK_RE)) {
    const raw = m[1];
    const pipe = raw.indexOf('|');
    const target = (pipe >= 0 ? raw.slice(0, pipe) : raw).trim();
    if (!target) continue;
    const label = (pipe >= 0 ? raw.slice(pipe + 1).trim() : '') || target;
    const key = target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ target, label });
  }
  return out;
}

/**
 * Resolve a link `target` to a page id. Tried in order: exact `slug`, then
 * any-locale `title` (case-insensitive), then `aliases` (case-insensitive).
 * Within a tier the most recently `updatedAt` page wins. Undefined = dangling.
 */
export function resolveLink(pages: Page[], target: string): string | undefined {
  const key = target.trim().toLowerCase();
  if (!key) return undefined;

  const newest = (matches: Page[]): string | undefined =>
    matches.length
      ? matches.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)).id
      : undefined;

  // Tier 1 — exact slug.
  const bySlug = newest(pages.filter((p) => p.slug.toLowerCase() === key));
  if (bySlug) return bySlug;

  // Tier 2 — any-locale title.
  const byTitle = newest(
    pages.filter((p) => locStrings(p.title).some((s) => s.trim().toLowerCase() === key))
  );
  if (byTitle) return byTitle;

  // Tier 3 — aliases.
  return newest(pages.filter((p) => p.aliases.some((a) => a.trim().toLowerCase() === key)));
}

/**
 * Backlinks for a target page: ids of all *other* pages whose body links
 * resolve to `targetId`. A page never backlinks to itself. Pure.
 */
export function backlinks(pages: Page[], targetId: string): string[] {
  if (!pages.some((p) => p.id === targetId)) return [];
  return pages
    .filter(
      (p) =>
        p.id !== targetId &&
        parseLinks(locStrings(p.body).join('\n')).some(
          (lnk) => resolveLink(pages, lnk.target) === targetId
        )
    )
    .map((p) => p.id);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip `[[…]]` wiki-link syntax from text, leaving nothing in its place. */
function stripLinks(text: string): string {
  return text.replace(LINK_RE, ' ');
}

/**
 * Unlinked mentions of a target page: ids of *other* pages whose body TEXT (any
 * locale) contains the target's title or any alias as a whole word
 * (case-insensitive) but which do NOT already `[[link]]` to it. Pure.
 */
export function unlinkedMentions(pages: Page[], targetId: string): string[] {
  const target = pages.find((p) => p.id === targetId);
  if (!target) return [];
  const names = [...locStrings(target.title), ...target.aliases]
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.length) return [];
  // Unicode-aware whole-word match: boundaries are "not a letter/number" on
  // either side, so Polish diacritics (ł ą ż ó …) count as word chars and a
  // mention flanked by non-ASCII punctuation still resolves.
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'iu'
  );

  return pages
    .filter((p) => {
      if (p.id === targetId) return false;
      // Already linked? Then it's a backlink, not an unlinked mention.
      if (parseLinks(locStrings(p.body).join('\n')).some((l) => resolveLink(pages, l.target) === targetId))
        return false;
      // Match against text with link syntax removed.
      return locStrings(p.body).some((s) => re.test(stripLinks(s)));
    })
    .map((p) => p.id);
}

export interface SearchFilter {
  kind?: PageKind;
  tag?: string;
}

/**
 * Case-insensitive substring search across both locales of title/summary/body
 * plus aliases and tags. Ranked title-hit > alias/tag-hit > body-hit; pinned
 * first within equal rank; then `updatedAt` desc. Optional kind/tag filter. An
 * empty query returns all (filtered) pages, pinned-first then `updatedAt` desc.
 * Pure.
 */
export function searchPages(pages: Page[], query: string, filter: SearchFilter = {}): Page[] {
  const q = query.trim().toLowerCase();
  const kind = filter.kind;
  const tag = filter.tag?.trim().toLowerCase();

  const byRankThenPinThenDate = (a: [Page, number], b: [Page, number]): number => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const pa = a[0].pinned ? 1 : 0;
    const pb = b[0].pinned ? 1 : 0;
    if (pb !== pa) return pb - pa;
    return b[0].updatedAt - a[0].updatedAt;
  };

  const passesFilter = (p: Page): boolean => {
    if (kind && p.kind !== kind) return false;
    if (tag && !p.tags.some((tg) => tg.toLowerCase() === tag)) return false;
    return true;
  };

  const ranked: [Page, number][] = [];
  for (const p of pages) {
    if (!passesFilter(p)) continue;
    if (!q) {
      ranked.push([p, 0]);
      continue;
    }
    const titleHit = locStrings(p.title).some((s) => s.toLowerCase().includes(q));
    const aliasTagHit =
      p.aliases.some((a) => a.toLowerCase().includes(q)) ||
      p.tags.some((tg) => tg.toLowerCase().includes(q));
    const bodyHit =
      locStrings(p.summary).some((s) => s.toLowerCase().includes(q)) ||
      locStrings(p.body).some((s) => s.toLowerCase().includes(q));
    const rank = titleHit ? 3 : aliasTagHit ? 2 : bodyHit ? 1 : 0;
    if (rank > 0) ranked.push([p, rank]);
  }
  return ranked.sort(byRankThenPinThenDate).map(([p]) => p);
}

/**
 * Migrate a raw stored record (old `{id,title:string,body:string}` shape, a
 * partial, or an already-new page) into a complete new-model `Page`. Old plain
 * strings stay plain-string LocalizedText (so `loc()` returns them for any
 * language). An existing valid `slug` is preserved (rename-proof); otherwise one
 * is derived from the title. The resulting slug is added to `takenSlugs` so
 * repeated calls stay collision-free. Pure aside from that set mutation.
 */
export function migratePage(raw: unknown, takenSlugs: Set<string>): Page {
  const r = (raw ?? {}) as Record<string, unknown>;

  const title = (r.title ?? '') as LocalizedText;
  const titleStr = locStrings(title)[0] ?? '';
  const base = slugify(typeof r.slug === 'string' && r.slug ? r.slug : titleStr);
  const slug = uniqueSlug(base, takenSlugs);
  takenSlugs.add(slug);

  const kind = PAGE_KINDS.includes(r.kind as PageKind) ? (r.kind as PageKind) : 'concept';

  const page: Page = {
    id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
    slug,
    kind,
    title,
    body: (r.body ?? '') as LocalizedText,
    aliases: Array.isArray(r.aliases) ? (r.aliases.filter((a) => typeof a === 'string') as string[]) : [],
    tags: Array.isArray(r.tags) ? (r.tags.filter((tg) => typeof tg === 'string') as string[]) : [],
    playerSafe: r.playerSafe === true,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
  if (r.summary != null) page.summary = r.summary as LocalizedText;
  if (r.secret != null) page.secret = r.secret as LocalizedText;
  if (typeof r.imageId === 'string') page.imageId = r.imageId;
  if (r.pinned === true) page.pinned = true;
  return page;
}

/** Convenience re-export: resolve a page's display title in a locale. */
export { loc };
