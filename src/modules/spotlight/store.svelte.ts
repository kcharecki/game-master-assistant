import { kvGet, kvSet } from '../../lib/db';
import { spotlightRows, type Player, type SpotlightRow } from './logic';

export type { Player, SpotlightRow } from './logic';

const SEED: Player[] = [
  { id: 'p1', name: 'Asha', last: Date.now() - 4 * 60_000 },
  { id: 'p2', name: 'Bram', last: Date.now() - 22 * 60_000 },
  { id: 'p3', name: 'Cora', last: 0 },
];

/**
 * Spotlight tracker (#15): per-player "last meaningful moment" timestamps,
 * surfacing who's overdue for the GM. GM-only reference.
 */
class SpotlightStore {
  players = $state<Player[]>(structuredClone(SEED));
  /** overdue threshold in minutes */
  thresholdMin = $state(15);
  /** bumped to force `rows` to recompute against the wall clock */
  #tick = $state(0);

  get rows(): SpotlightRow[] {
    void this.#tick;
    return spotlightRows($state.snapshot(this.players), Date.now(), this.thresholdMin * 60_000);
  }

  /** Re-evaluate against the current time (call on a timer / on view focus). */
  refresh(): void {
    this.#tick++;
  }

  add(name = 'New player'): Player {
    const p: Player = { id: crypto.randomUUID(), name, last: 0 };
    this.players.push(p);
    this.persist();
    return p;
  }

  /** Mark a player as having just had a meaningful moment. */
  mark(id: string): void {
    const p = this.players.find((x) => x.id === id);
    if (p) p.last = Date.now();
    this.persist();
  }

  rename(id: string, name: string): void {
    const p = this.players.find((x) => x.id === id);
    if (p) p.name = name;
    this.persist();
  }

  remove(id: string): void {
    this.players = this.players.filter((p) => p.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('spotlightPlayers', $state.snapshot(this.players));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Player[]>('spotlightPlayers');
    if (saved?.length) this.players = saved;
  }
}

export const spotlight = new SpotlightStore();
