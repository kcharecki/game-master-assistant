import { kvGet, kvSet } from '../../lib/db';
import { dueAt, byCount, type Reminder } from './logic';

export type { Reminder } from './logic';

const SEED: Reminder[] = [
  { id: 'r1', label: 'Lair action (grasping roots)', count: 20 },
  { id: 'r2', label: 'Boss legendary action', count: 20 },
];

/**
 * Legendary/lair action reminders (#4): the GM registers actions tied to an
 * initiative count and dials in the current count to see what's due. GM-only.
 */
class RemindersStore {
  list = $state<Reminder[]>(structuredClone(SEED));
  /** the initiative count currently being resolved */
  current = $state(20);

  get sorted(): Reminder[] {
    return byCount($state.snapshot(this.list));
  }

  /** Reminders firing at the current initiative count. */
  get due(): Reminder[] {
    return dueAt($state.snapshot(this.list), this.current);
  }

  add(label = 'New reminder', count = 20): Reminder {
    const r: Reminder = { id: crypto.randomUUID(), label, count };
    this.list.push(r);
    this.persist();
    return r;
  }

  update(id: string, patch: Partial<Omit<Reminder, 'id'>>): void {
    const r = this.list.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    this.persist();
  }

  remove(id: string): void {
    this.list = this.list.filter((r) => r.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('reminders', $state.snapshot(this.list));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Reminder[]>('reminders');
    if (saved?.length) this.list = saved;
  }
}

export const reminders = new RemindersStore();
