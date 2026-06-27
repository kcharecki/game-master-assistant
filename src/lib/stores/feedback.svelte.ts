import { kvGet, kvSet } from '../db';
import type { ModuleId } from '../module';
import type { FeedbackItem } from '../feedback';

export type { FeedbackItem } from '../feedback';

/**
 * GM-authored feedback for the programmer, keyed by component (module). Persists
 * to kv `feedback`, so it rides along in the campaign export automatically.
 */
class FeedbackStore {
  items = $state<FeedbackItem[]>([]);
  #loaded = false;

  add(module: ModuleId, title: string, text: string): void {
    const t = text.trim();
    if (!t) return;
    this.items.push({ id: crypto.randomUUID(), module, title, text: t, at: Date.now() });
    this.persist();
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    this.persist();
  }

  forModule(module: ModuleId): FeedbackItem[] {
    return this.items.filter((i) => i.module === module);
  }

  persist(): void {
    void kvSet('feedback', $state.snapshot(this.items));
  }

  /** Load once; safe to call from every window mount. */
  async load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    const saved = await kvGet<FeedbackItem[]>('feedback');
    if (saved?.length) this.items = saved;
  }
}

export const feedback = new FeedbackStore();
