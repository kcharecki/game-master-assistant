import { kvSet, kvGet, assetPut } from '../../lib/db';
import {
  backlinks,
  parseLinks,
  resolveLink,
  unlinkedMentions,
  searchPages,
  slugify,
  uniqueSlug,
  migratePage,
  stripMarkup,
  type Page,
  type PageKind,
  type SearchFilter,
} from './logic';
import { exportPages, parseImport } from './io';
import type { BroadcastPayload } from '../../lib/types';
import { loc, setLoc, locStrings, type LocalizedText } from '../../lib/loc';
import type { Locale } from '../../lib/stores/lang.svelte';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';

export type { Page, PageKind } from './logic';

const SEED: Page[] = [
  {
    id: 'innsmouth',
    slug: 'innsmouth',
    kind: 'place',
    title: { en: 'Innsmouth', pl: 'Innsmouth' },
    body: {
      en: 'A decaying fishing town. Locals shun outsiders. See the [[Marsh Refinery]] and the [[Esoteric Order]].',
      pl: 'Podupadające miasteczko rybackie. Miejscowi stronią od obcych. Zobacz [[Marsh Refinery]] oraz [[Esoteric Order]].',
    },
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
    body: {
      en: 'Gold refinery on the waterfront, run by the [[Esoteric Order]]. Source of the town’s odd prosperity.',
      pl: 'Rafineria złota na nabrzeżu, prowadzona przez [[Esoteric Order]]. Źródło dziwnego dobrobytu miasta.',
    },
    aliases: [],
    tags: ['town'],
    playerSafe: true,
    updatedAt: 2,
  },
  {
    id: 'order',
    slug: 'esoteric-order',
    kind: 'faction',
    title: { en: 'Esoteric Order', pl: 'Ezoteryczny Zakon' },
    body: {
      en: 'A secretive cult that has supplanted the old churches of [[Innsmouth]].',
      pl: 'Tajemniczy kult, który wyparł dawne kościoły [[Innsmouth]].',
    },
    aliases: [],
    tags: ['faction'],
    playerSafe: true,
    updatedAt: 3,
  },
];

/** Cross-linked, bilingual lore pages with [[wiki links]] and backlinks. */
class LoreStore {
  pages = $state<Page[]>(structuredClone(SEED));
  selectedId = $state<string>(SEED[0].id);

  get selected(): Page | undefined {
    return this.pages.find((p) => p.id === this.selectedId);
  }

  /** Outgoing links from a page, with resolved target id (undefined = dangling). */
  linksOf(id: string): { target: string; label: string; targetId: string | undefined }[] {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return [];
    const snap = $state.snapshot(this.pages) as Page[];
    return parseLinks(locStrings(page.body).join('\n')).map((l) => ({
      target: l.target,
      label: l.label,
      targetId: resolveLink(snap, l.target),
    }));
  }

  /** Pages that link to the given page. */
  backlinksOf(id: string): Page[] {
    const ids = backlinks($state.snapshot(this.pages) as Page[], id);
    return this.pages.filter((p) => ids.includes(p.id));
  }

  /** Pages that mention the given page in prose but don't link to it. */
  mentionsOf(id: string): Page[] {
    const ids = unlinkedMentions($state.snapshot(this.pages) as Page[], id);
    return this.pages.filter((p) => ids.includes(p.id));
  }

  /** Ranked search across both locales; optional kind/tag filter. */
  search(query: string, filter: SearchFilter = {}): Page[] {
    const snap = $state.snapshot(this.pages) as Page[];
    // Preserve searchPages order while returning live (reactive) page objects.
    return searchPages(snap, query, filter)
      .map((r) => this.pages.find((p) => p.id === r.id))
      .filter((p): p is Page => !!p);
  }

  add(kind: PageKind = 'concept', title: LocalizedText = ''): Page {
    const taken = this.pages.map((p) => p.slug);
    const base = slugify(locStrings(title)[0] ?? '');
    const page: Page = {
      id: crypto.randomUUID(),
      slug: uniqueSlug(base, taken),
      kind,
      title,
      body: '',
      aliases: [],
      tags: [],
      playerSafe: false,
      updatedAt: Date.now(),
    };
    this.pages.push(page);
    this.selectedId = page.id;
    this.persist();
    return page;
  }

  /**
   * Patch a page. Bumps `updatedAt`. `slug`/`id` are never changed here. If the
   * title changes, the previous primary title is kept as an alias (rename-proof
   * search + link resolution).
   */
  update(id: string, patch: Partial<Omit<Page, 'id' | 'slug'>>): void {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    if (patch.title !== undefined) {
      const oldPrimary = (locStrings(page.title)[0] ?? '').trim();
      const newPrimary = (locStrings(patch.title)[0] ?? '').trim();
      if (
        oldPrimary &&
        oldPrimary.toLowerCase() !== newPrimary.toLowerCase() &&
        !page.aliases.some((a) => a.trim().toLowerCase() === oldPrimary.toLowerCase())
      ) {
        page.aliases.push(oldPrimary);
      }
    }
    Object.assign(page, patch);
    page.updatedAt = Date.now();
    this.persist();
  }

  /** Set one locale of a localized field, preserving the other language. */
  setField(id: string, field: 'title' | 'summary' | 'body' | 'secret', lang: Locale, text: string): void {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    page[field] = setLoc(page[field], lang, text);
    page.updatedAt = Date.now();
    this.persist();
  }

  /** Store an uploaded image blob and attach it to the page. */
  async setImage(id: string, blob: Blob): Promise<void> {
    const assetId = await assetPut(blob, blob.type || 'image/*');
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    page.imageId = assetId;
    page.updatedAt = Date.now();
    this.persist();
  }

  togglePin(id: string): void {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    page.pinned = !page.pinned;
    this.persist();
  }

  remove(id: string): void {
    const i = this.pages.findIndex((p) => p.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.pages[i]) as Page;
    // Remember the neighbor that followed so undo can restore relative position.
    const nextId = this.pages[i + 1]?.id;
    const prevSelected = this.selectedId;
    this.pages = this.pages.filter((p) => p.id !== id);
    if (this.selectedId === id) this.selectedId = this.pages[0]?.id ?? '';
    this.persist();
    toast.undoable(t('toast.loreDeleted'), () => {
      const back = this.pages.slice();
      const insertAt = nextId ? back.findIndex((p) => p.id === nextId) : -1;
      back.splice(insertAt >= 0 ? insertAt : back.length, 0, removed);
      this.pages = back;
      this.selectedId = prevSelected;
      this.persist();
    });
  }

  select(id: string): void {
    if (this.pages.some((p) => p.id === id)) this.selectedId = id;
  }

  /**
   * Build the broadcast payload for a page in a locale. Returns null when the
   * page is missing or not player-safe (secrets never cross the bus). `image`
   * (with an attached `imageId`) sends the page picture captioned by its title;
   * otherwise a parchment text card whose body is `stripMarkup`-flattened for
   * the raw-rendering broadcast page. `summary` falls back to `body` when empty.
   */
  revealPayload(
    id: string,
    locale: Locale,
    which: 'summary' | 'body' | 'image'
  ): BroadcastPayload | null {
    const page = this.pages.find((p) => p.id === id);
    if (!page || !page.playerSafe) return null;
    if (which === 'image' && page.imageId) {
      return { kind: 'image', assetId: page.imageId, caption: loc(page.title, locale) };
    }
    const source = which === 'summary' && page.summary ? page.summary : page.body;
    return {
      kind: 'text',
      title: loc(page.title, locale),
      body: stripMarkup(loc(source, locale)),
      theme: 'parchment',
    };
  }

  /** Serialize all pages to a portable, pretty JSON string (no image blobs). */
  exportJSON(): string {
    return exportPages($state.snapshot(this.pages) as Page[]);
  }

  /**
   * Import pages from an exported JSON string. `merge` adds/replaces by slug
   * (imported slug wins, other pages kept); `replace` swaps the whole set.
   * Persists and reselects the first page. Returns the number of records
   * imported — in `merge` mode this counts replacements as well as new pages
   * (or an error string on bad/foreign JSON — nothing is changed then).
   */
  importJSON(text: string, mode: 'merge' | 'replace'): { imported: number; error?: string } {
    const { pages, error } = parseImport(text);
    if (error) return { imported: 0, error };
    if (mode === 'replace') {
      this.pages = pages;
    } else {
      const bySlug = new Map(this.pages.map((p) => [p.slug, p] as const));
      for (const p of pages) bySlug.set(p.slug, p);
      this.pages = [...bySlug.values()];
    }
    this.selectedId = this.pages[0]?.id ?? '';
    this.persist();
    return { imported: pages.length };
  }

  persist(): void {
    void kvSet('lorePages', $state.snapshot(this.pages));
  }

  async load(): Promise<void> {
    const saved = await kvGet<unknown[]>('lorePages');
    if (saved?.length) {
      const taken = new Set<string>();
      this.pages = saved.map((r) => migratePage(r, taken));
      this.selectedId = this.pages[0].id;
    }
  }
}

export const lore = new LoreStore();
