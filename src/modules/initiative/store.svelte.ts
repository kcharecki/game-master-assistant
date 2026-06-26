import { kvSet, kvGet } from '../../lib/db';

export interface Combatant {
  id: string;
  name: string;
  role: string;
  /** initiative value; list is kept sorted high -> low */
  init: number;
  foe: boolean;
}

const SEED: Combatant[] = [
  { id: 'wh', name: 'William Harcourt', role: 'Investigator', init: 65, foe: false },
  { id: 'er', name: 'Dr. Evelyn Reed', role: 'Investigator', init: 48, foe: false },
  { id: 'fm', name: 'Father Mateo', role: 'Investigator', init: 37, foe: false },
  { id: 'sm', name: 'Silas Marsh', role: 'Investigator', init: 22, foe: false },
  { id: 'do', name: 'Deep One Hybrid', role: 'Monster', init: 12, foe: true },
];

/** Initiative tracker: ordered turn list with an active marker and round counter. */
export class InitiativeStore {
  order = $state<Combatant[]>([...SEED]);
  active = $state(0);
  round = $state(1);

  add(name = 'Combatant', init = 10, foe = false): Combatant {
    const c: Combatant = { id: crypto.randomUUID(), name, role: foe ? 'Monster' : '', init, foe };
    this.order.push(c);
    this.persist();
    return c;
  }

  remove(id: string): void {
    const i = this.order.findIndex((c) => c.id === id);
    if (i === -1) return;
    this.order.splice(i, 1);
    if (i < this.active) this.active -= 1;
    if (this.active >= this.order.length) this.active = Math.max(0, this.order.length - 1);
    this.persist();
  }

  /** Move a combatant up (earlier) in the turn order. */
  moveUp(id: string): void {
    const i = this.order.findIndex((c) => c.id === id);
    if (i <= 0) return;
    [this.order[i - 1], this.order[i]] = [this.order[i], this.order[i - 1]];
    this.persist();
  }

  /** Move a combatant down (later) in the turn order. */
  moveDown(id: string): void {
    const i = this.order.findIndex((c) => c.id === id);
    if (i === -1 || i >= this.order.length - 1) return;
    [this.order[i + 1], this.order[i]] = [this.order[i], this.order[i + 1]];
    this.persist();
  }

  /** Advance the active marker; increments the round counter on wrap. */
  nextTurn(): void {
    if (this.order.length === 0) return;
    this.active += 1;
    if (this.active >= this.order.length) {
      this.active = 0;
      this.round += 1;
    }
    this.persist();
  }

  reset(): void {
    this.active = 0;
    this.round = 1;
    this.persist();
  }

  persist(): void {
    void kvSet('initiative', {
      order: $state.snapshot(this.order),
      active: this.active,
      round: this.round,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{ order: Combatant[]; active: number; round: number }>('initiative');
    if (saved?.order?.length) {
      this.order = saved.order;
      this.active = saved.active ?? 0;
      this.round = saved.round ?? 1;
    }
  }
}

export const initiative = new InitiativeStore();
