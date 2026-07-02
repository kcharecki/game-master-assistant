import { kvSet, kvGet } from '../../lib/db';
import { backlinks, parseLinks, resolveLink, type Page } from './logic';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';

export type { Page } from './logic';

const SEED: Page[] = [
  {
    id: 'innsmouth',
    title: 'Innsmouth',
    body: 'A decaying fishing town. Locals shun outsiders. See the [[Marsh Refinery]] and the [[Esoteric Order]].',
  },
  {
    id: 'refinery',
    title: 'Marsh Refinery',
    body: 'Gold refinery on the waterfront, run by the [[Esoteric Order]]. Source of the town’s odd prosperity.',
  },
  {
    id: 'order',
    title: 'Esoteric Order',
    body: 'A secretive cult that has supplanted the old churches of [[Innsmouth]].',
  },
];

/** Cross-linked lore pages with [[wiki links]] and computed backlinks. */
class LoreStore {
  pages = $state<Page[]>([...SEED]);
  selectedId = $state<string>(SEED[0].id);

  get selected(): Page | undefined {
    return this.pages.find((p) => p.id === this.selectedId);
  }

  /** Outgoing links from a page, with resolved target id (undefined = dangling). */
  linksOf(id: string): { title: string; targetId: string | undefined }[] {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return [];
    return parseLinks(page.body).map((title) => ({
      title,
      targetId: resolveLink($state.snapshot(this.pages), title),
    }));
  }

  /** Pages that link to the given page. */
  backlinksOf(id: string): Page[] {
    const ids = backlinks($state.snapshot(this.pages), id);
    return this.pages.filter((p) => ids.includes(p.id));
  }

  add(title = 'New Page'): Page {
    const page: Page = { id: crypto.randomUUID(), title, body: '' };
    this.pages.push(page);
    this.selectedId = page.id;
    this.persist();
    return page;
  }

  update(id: string, patch: Partial<Omit<Page, 'id'>>): void {
    const page = this.pages.find((p) => p.id === id);
    if (page) Object.assign(page, patch);
    this.persist();
  }

  remove(id: string): void {
    const i = this.pages.findIndex((p) => p.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.pages[i]) as Page;
    const prevSelected = this.selectedId;
    this.pages = this.pages.filter((p) => p.id !== id);
    if (this.selectedId === id) this.selectedId = this.pages[0]?.id ?? '';
    this.persist();
    toast.undoable(t('toast.loreDeleted'), () => {
      const back = this.pages.slice();
      back.splice(i, 0, removed);
      this.pages = back;
      this.selectedId = prevSelected;
      this.persist();
    });
  }

  select(id: string): void {
    if (this.pages.some((p) => p.id === id)) this.selectedId = id;
  }

  persist(): void {
    void kvSet('lorePages', $state.snapshot(this.pages));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Page[]>('lorePages');
    if (saved?.length) {
      this.pages = saved;
      this.selectedId = saved[0].id;
    }
  }
}

export const lore = new LoreStore();
