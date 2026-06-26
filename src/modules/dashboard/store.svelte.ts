import { kvGet, kvSet } from '../../lib/db';
import { byPerception, topPerception, type PartyMember } from './logic';

export type { PartyMember } from './logic';

const SEED: PartyMember[] = [
  { id: 'p1', name: 'Asha', ac: 16, pp: 14, saves: 'DEX +5, WIS +3', languages: 'Common, Elvish', resistances: '—' },
  { id: 'p2', name: 'Bram', ac: 18, pp: 11, saves: 'STR +6, CON +5', languages: 'Common, Dwarvish', resistances: 'Poison' },
];

/**
 * Player dashboard (#12): at-a-glance party defenses for the GM — passive
 * Perception, AC, saves, languages, resistances. GM reference only; never
 * broadcast.
 */
class DashboardStore {
  party = $state<PartyMember[]>(structuredClone(SEED));

  get sorted(): PartyMember[] {
    return byPerception($state.snapshot(this.party));
  }

  get topPP(): number {
    return topPerception($state.snapshot(this.party));
  }

  add(name = 'New PC'): PartyMember {
    const m: PartyMember = { id: crypto.randomUUID(), name, ac: 10, pp: 10 };
    this.party.push(m);
    this.persist();
    return m;
  }

  update(id: string, patch: Partial<Omit<PartyMember, 'id'>>): void {
    const m = this.party.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
    this.persist();
  }

  remove(id: string): void {
    this.party = this.party.filter((m) => m.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('dashboardParty', $state.snapshot(this.party));
  }

  async load(): Promise<void> {
    const saved = await kvGet<PartyMember[]>('dashboardParty');
    if (saved?.length) this.party = saved;
  }
}

export const dashboard = new DashboardStore();
