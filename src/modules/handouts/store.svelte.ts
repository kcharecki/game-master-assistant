import { kvGet, kvSet, assetPut } from '../../lib/db';
import { putOnAir } from '../reveal/bus-actions';
import { handoutPayload, type Handout } from './logic';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';

export type { Handout } from './logic';

const SEED: Handout[] = [
  {
    id: 'h1',
    title: 'A Letter from the Order',
    body: 'You are summoned to the refinery at the turning of the tide. Tell no one. — E.O.',
  },
  {
    id: 'h2',
    title: 'Torn Newspaper Clipping',
    body: 'INNSMOUTH — Three more fishermen missing this fortnight; the harbormaster declines comment.',
  },
];

/**
 * Letters/handouts library (feature #13, letter side). The GM composes
 * handouts here and pushes one to the broadcast reveal as a text or image.
 * GM-only library; only the chosen handout reaches players.
 */
class HandoutStore {
  list = $state<Handout[]>(structuredClone(SEED));

  add(title = 'New Handout'): Handout {
    const h: Handout = { id: crypto.randomUUID(), title, body: '' };
    this.list.push(h);
    this.persist();
    return h;
  }

  update(id: string, patch: Partial<Omit<Handout, 'id'>>): void {
    const h = this.list.find((x) => x.id === id);
    if (h) Object.assign(h, patch);
    this.persist();
  }

  remove(id: string): void {
    const i = this.list.findIndex((h) => h.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.list[i]) as Handout;
    this.list = this.list.filter((h) => h.id !== id);
    this.persist();
    toast.undoable(t('toast.handoutDeleted'), () => {
      const back = this.list.slice();
      back.splice(i, 0, removed);
      this.list = back;
      this.persist();
    });
  }

  /** Attach an uploaded image to a handout, storing it in the asset store. */
  async attachImage(id: string, file: File): Promise<void> {
    const assetId = await assetPut(file, file.type || 'image/png');
    this.update(id, { assetId });
  }

  /** Push a handout to the broadcast reveal (text, or image if it has one). */
  send(id: string): void {
    const h = this.list.find((x) => x.id === id);
    if (!h) return;
    putOnAir(handoutPayload($state.snapshot(h)));
  }

  persist(): void {
    void kvSet('handouts', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Handout[]>('handouts');
    if (saved?.length) this.list = saved;
  }
}

export const handouts = new HandoutStore();
