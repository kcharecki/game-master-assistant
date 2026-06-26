import { kvSet, kvGet } from '../../lib/db';

export interface Effect {
  id: string;
  /** who/what the effect is on, free text */
  target: string;
  /** effect name, e.g. "Poisoned" */
  name: string;
  /** rounds remaining; 0 or below means expired */
  rounds: number;
}

/**
 * Tracks named effects with a remaining-rounds countdown. tick() decrements
 * every active effect, removes any that hit 0, and returns the list that just
 * expired so the UI can announce them.
 */
export class ConditionStore {
  list = $state<Effect[]>([]);

  add(target: string, name: string, rounds: number): Effect {
    const e: Effect = { id: crypto.randomUUID(), target, name, rounds: Math.max(0, rounds) };
    this.list.push(e);
    this.persist();
    return e;
  }

  remove(id: string): void {
    this.list = this.list.filter((e) => e.id !== id);
    this.persist();
  }

  /** Advance one round. Decrements all effects, auto-expiring at 0. Returns expired effects. */
  tick(): Effect[] {
    const expired: Effect[] = [];
    for (const e of this.list) {
      e.rounds -= 1;
      if (e.rounds <= 0) expired.push({ ...e });
    }
    if (expired.length) {
      const dead = new Set(expired.map((e) => e.id));
      this.list = this.list.filter((e) => !dead.has(e.id));
    }
    this.persist();
    return expired;
  }

  persist(): void {
    void kvSet('conditions', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Effect[]>('conditions');
    if (saved?.length) this.list = saved;
  }
}

export const conditions = new ConditionStore();
