import { kvSet, kvGet } from '../../lib/db';

/** A tracked status effect. `rounds === null` means it lasts until cleared. */
export interface Condition {
  name: string;
  rounds: number | null;
}

export interface Combatant {
  id: string;
  name: string;
  /** initiative value; list is kept sorted high -> low */
  init: number;
  foe: boolean;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: Condition[];
  /** when true, real HP is GM-only and never broadcast — players see a vague status. */
  hidden: boolean;
}

const SEED: Combatant[] = [
  { id: 'wh', name: 'William Harcourt', init: 65, foe: false, hp: 11, maxHp: 11, ac: 12, conditions: [], hidden: false },
  { id: 'er', name: 'Dr. Evelyn Reed', init: 48, foe: false, hp: 6, maxHp: 9, ac: 11, conditions: [{ name: 'Frightened', rounds: 1 }], hidden: false },
  { id: 'fm', name: 'Father Mateo', init: 37, foe: false, hp: 10, maxHp: 10, ac: 10, conditions: [], hidden: false },
  { id: 'sm', name: 'Silas Marsh', init: 22, foe: false, hp: 13, maxHp: 13, ac: 13, conditions: [], hidden: false },
  { id: 'do', name: 'Deep One Hybrid', init: 12, foe: true, hp: 9, maxHp: 22, ac: 14, conditions: [{ name: 'Prone', rounds: null }], hidden: true },
];

/** Conditions offered in the row editor toggle grid. */
export const CONDITIONS = [
  'Poisoned', 'Prone', 'Frightened', 'Stunned', 'Restrained', 'Grappled',
  'Blinded', 'Charmed', 'Invisible', 'Concentrating', 'Blessed', 'Cursed',
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

/** Initiative tracker: ordered turn list with an active combatant and round counter. */
export class InitiativeStore {
  order = $state<Combatant[]>([...SEED]);
  /** id of the combatant whose turn it is; null when the list is empty. */
  activeId = $state<string | null>(SEED[0]?.id ?? null);
  round = $state(1);

  add(name = 'Combatant', init = 10, foe = false): Combatant {
    const c: Combatant = {
      id: crypto.randomUUID(),
      name,
      init,
      foe,
      hp: 10,
      maxHp: 10,
      ac: 10,
      conditions: [],
      hidden: foe,
    };
    this.order.push(c);
    this.sortByInit();
    if (this.activeId === null) this.activeId = c.id;
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

  /** Re-sort the list high -> low by initiative, keeping the active combatant. */
  sortByInit(): void {
    this.order.sort((a, b) => b.init - a.init);
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

  /** Add a condition (indefinite) or remove it if already present. */
  toggleCondition(id: string, name: string): void {
    const c = this.#find(id);
    if (!c) return;
    const i = c.conditions.findIndex((k) => k.name === name);
    if (i === -1) c.conditions.push({ name, rounds: null });
    else c.conditions.splice(i, 1);
    this.persist();
  }

  /** Cycle a condition's remaining rounds: ∞ -> 3 -> 2 -> 1 -> ∞. */
  cycleDuration(id: string, name: string): void {
    const c = this.#find(id);
    if (!c) return;
    const k = c.conditions.find((x) => x.name === name);
    if (!k) return;
    k.rounds = k.rounds == null ? 3 : k.rounds > 1 ? k.rounds - 1 : null;
    this.persist();
  }

  toggleHidden(id: string): void {
    const c = this.#find(id);
    if (!c) return;
    c.hidden = !c.hidden;
    this.persist();
  }

  toggleFoe(id: string): void {
    const c = this.#find(id);
    if (!c) return;
    c.foe = !c.foe;
    this.persist();
  }

  remove(id: string): void {
    const i = this.order.findIndex((c) => c.id === id);
    if (i === -1) return;
    const wasActive = this.activeId === id;
    this.order.splice(i, 1);
    if (wasActive) {
      const next = this.order[Math.min(i, this.order.length - 1)];
      this.activeId = next ? next.id : null;
    }
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

  /** Drag-reorder: drop `dragId` onto the row of `targetId`. */
  reorder(dragId: string, targetId: string): void {
    if (dragId === targetId) return;
    const from = this.order.findIndex((c) => c.id === dragId);
    const target = this.order.findIndex((c) => c.id === targetId);
    if (from === -1 || target === -1) return;
    const [c] = this.order.splice(from, 1);
    const to = this.order.findIndex((x) => x.id === targetId);
    // dropping downward lands after the target, upward lands before it
    this.order.splice(from < target ? to + 1 : to, 0, c);
    this.persist();
  }

  /** Advance to the next combatant; on wrap, tick condition durations and bump the round. */
  nextTurn(): void {
    if (this.order.length === 0) return;
    const i = Math.max(0, this.order.findIndex((c) => c.id === this.activeId));
    const ni = (i + 1) % this.order.length;
    if (ni <= i) {
      // wrapped to the top: new round — decrement timed conditions, drop the expired
      for (const c of this.order) {
        c.conditions = c.conditions.filter((k) => {
          if (k.rounds == null) return true;
          k.rounds -= 1;
          return k.rounds > 0;
        });
      }
      this.round += 1;
    }
    this.activeId = this.order[ni].id;
    this.persist();
  }

  reset(): void {
    this.activeId = this.order[0]?.id ?? null;
    this.round = 1;
    this.persist();
  }

  persist(): void {
    void kvSet('initiative', {
      order: $state.snapshot(this.order),
      activeId: this.activeId,
      round: this.round,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{ order: Combatant[]; activeId: string | null; round: number }>(
      'initiative',
    );
    if (saved?.order?.length) {
      this.order = saved.order;
      this.activeId = saved.activeId ?? saved.order[0].id;
      this.round = saved.round ?? 1;
    }
  }
}

export const initiative = new InitiativeStore();
