import { kvSet, kvGet } from '../../lib/db';
import { ordered, move, add, remove, type Beat } from './logic';

export type { Beat } from './logic';

const SEED: Beat[] = [
  { id: 'b1', title: 'Cold open: storm at sea', order: 0 },
  { id: 'b2', title: 'Arrival in town', order: 1 },
  { id: 'b3', title: 'The refinery confrontation', order: 2 },
];

/** Scene/beat planner: ordered, movable cards sketching session flow (GM-only). */
class BeatsStore {
  beats = $state<Beat[]>(structuredClone(SEED));

  get cards(): Beat[] {
    return ordered($state.snapshot(this.beats));
  }

  add(title = 'New beat'): void {
    this.beats = add($state.snapshot(this.beats), title);
    this.persist();
  }

  move(id: string, dir: -1 | 1): void {
    this.beats = move($state.snapshot(this.beats), id, dir);
    this.persist();
  }

  rename(id: string, title: string): void {
    const b = this.beats.find((x) => x.id === id);
    if (b) b.title = title;
    this.persist();
  }

  remove(id: string): void {
    this.beats = remove($state.snapshot(this.beats), id);
    this.persist();
  }

  persist(): void {
    void kvSet('beats', $state.snapshot(this.beats));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Beat[]>('beats');
    if (saved?.length) this.beats = saved;
  }
}

export const beats = new BeatsStore();
