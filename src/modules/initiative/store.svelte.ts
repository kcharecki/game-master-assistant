import { kvSet, kvGet } from '../../lib/db';

export interface Combatant {
  id: string;
  name: string;
  role: string;
  /** initiative value; list is kept sorted high -> low */
  init: number;
  foe: boolean;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  /** when true, real HP is GM-only and never broadcast — players see a vague status. */
  hidden: boolean;
}

const SEED: Combatant[] = [
  { id: 'wh', name: 'William Harcourt', role: 'Investigator', init: 65, foe: false, hp: 11, maxHp: 11, ac: 12, conditions: [], hidden: false },
  { id: 'er', name: 'Dr. Evelyn Reed', role: 'Investigator', init: 48, foe: false, hp: 9, maxHp: 9, ac: 11, conditions: [], hidden: false },
  { id: 'fm', name: 'Father Mateo', role: 'Investigator', init: 37, foe: false, hp: 10, maxHp: 10, ac: 10, conditions: [], hidden: false },
  { id: 'sm', name: 'Silas Marsh', role: 'Investigator', init: 22, foe: false, hp: 13, maxHp: 13, ac: 13, conditions: [], hidden: false },
  { id: 'do', name: 'Deep One Hybrid', role: 'Monster', init: 12, foe: true, hp: 22, maxHp: 22, ac: 14, conditions: [], hidden: true },
];

/** hp <= half of maxHp (and still alive) => bloodied. */
export function isBloodied(c: Combatant): boolean {
  return c.hp > 0 && c.hp <= c.maxHp / 2;
}

/** Player-safe status for a hidden combatant — never leaks exact HP. */
export function vagueStatus(c: Combatant): string {
  if (c.hp <= 0) return 'Down';
  if (c.hp <= c.maxHp / 4) return 'Near death';
  if (c.hp <= c.maxHp / 2) return 'Bloodied';
  if (c.hp < c.maxHp) return 'Wounded';
  return 'Healthy';
}

/** Initiative tracker: ordered turn list with an active marker and round counter. */
export class InitiativeStore {
  order = $state<Combatant[]>([...SEED]);
  active = $state(0);
  round = $state(1);

  add(name = 'Combatant', init = 10, foe = false): Combatant {
    const c: Combatant = {
      id: crypto.randomUUID(),
      name,
      role: foe ? 'Monster' : '',
      init,
      foe,
      hp: 10,
      maxHp: 10,
      ac: 10,
      conditions: [],
      hidden: foe,
    };
    this.order.push(c);
    this.persist();
    return c;
  }

  #find(id: string): Combatant | undefined {
    return this.order.find((c) => c.id === id);
  }

  /** Edit combatant fields directly. Numeric fields are clamped so hp never exceeds maxHp. */
  set(id: string, patch: Partial<Omit<Combatant, 'id'>>): void {
    const c = this.#find(id);
    if (!c) return;
    Object.assign(c, patch);
    if (c.maxHp < 0) c.maxHp = 0;
    if (c.hp > c.maxHp) c.hp = c.maxHp;
    if (c.hp < 0) c.hp = 0;
    this.persist();
  }

  /** Apply damage, clamped to 0. */
  damage(id: string, amount: number): void {
    const c = this.#find(id);
    if (!c) return;
    c.hp = Math.max(0, c.hp - Math.max(0, amount));
    this.persist();
  }

  /** Heal, clamped to maxHp. */
  heal(id: string, amount: number): void {
    const c = this.#find(id);
    if (!c) return;
    c.hp = Math.min(c.maxHp, c.hp + Math.max(0, amount));
    this.persist();
  }

  toggleCondition(id: string, name: string): void {
    const c = this.#find(id);
    if (!c) return;
    const i = c.conditions.indexOf(name);
    if (i === -1) c.conditions.push(name);
    else c.conditions.splice(i, 1);
    this.persist();
  }

  toggleHidden(id: string): void {
    const c = this.#find(id);
    if (!c) return;
    c.hidden = !c.hidden;
    this.persist();
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
