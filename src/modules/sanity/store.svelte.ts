import { kvSet, kvGet } from '../../lib/db';
import { parseSanLoss, sanLossRoll, type SanLossResult } from './logic';

export interface Investigator {
  id: string;
  name: string;
  san: number;
  maxSan: number;
}

const SEED: Investigator[] = [
  { id: 'p1', name: 'Dr. Armitage', san: 65, maxSan: 65 },
  { id: 'p2', name: 'Prof. Rice', san: 50, maxSan: 55 },
  { id: 'p3', name: 'Mr. Morgan', san: 40, maxSan: 45 },
];

/** Per-investigator Sanity (Call of Cthulhu). */
class SanityStore {
  list = $state<Investigator[]>([...SEED]);
  /** last SAN-loss result, surfaced in the widget */
  last = $state<{ id: string; result: SanLossResult } | null>(null);

  add(name = 'New Investigator'): Investigator {
    const inv: Investigator = { id: crypto.randomUUID(), name, san: 50, maxSan: 50 };
    this.list.push(inv);
    this.persist();
    return inv;
  }

  remove(id: string): void {
    this.list = this.list.filter((i) => i.id !== id);
    if (this.last?.id === id) this.last = null;
    this.persist();
  }

  update(id: string, patch: Partial<Omit<Investigator, 'id'>>): void {
    const inv = this.list.find((i) => i.id === id);
    if (inv) Object.assign(inv, patch);
    this.persist();
  }

  /** Roll a SAN-loss spec ("1/1d6") for one investigator and apply the loss. */
  rollLoss(id: string, spec: string, rng?: () => number): SanLossResult | null {
    const inv = this.list.find((i) => i.id === id);
    const parsed = parseSanLoss(spec);
    if (!inv || !parsed) return null;
    const result = sanLossRoll(inv.san, parsed, rng);
    inv.san = result.remaining;
    this.last = { id, result };
    this.persist();
    return result;
  }

  persist(): void {
    void kvSet('sanity', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Investigator[]>('sanity');
    if (saved?.length) this.list = saved;
  }
}

export const sanity = new SanityStore();
