import { kvSet, kvGet } from '../../lib/db';
import {
  advance,
  moonPhase,
  upcoming,
  formatDate,
  DEFAULT_CONFIG,
  type WorldDate,
  type WorldEvent,
  type MoonPhase,
} from './logic';

export type { WorldDate, WorldEvent } from './logic';

interface CalState {
  current: WorldDate;
  events: WorldEvent[];
}

const SEED: CalState = {
  current: { day: 12, month: 5, year: 1492 },
  events: [
    { id: 'fest', date: { day: 20, month: 5, year: 1492 }, title: 'Greengrass festival' },
    { id: 'eclipse', date: { day: 1, month: 7, year: 1492 }, title: 'Lunar eclipse omen' },
  ],
};

/** In-world calendar: a current date, scheduled events, computed moon phase. */
class CalendarStore {
  current = $state<WorldDate>({ ...SEED.current });
  events = $state<WorldEvent[]>([...SEED.events]);

  get moon(): MoonPhase {
    return moonPhase(this.current, DEFAULT_CONFIG);
  }

  get label(): string {
    return formatDate(this.current, DEFAULT_CONFIG);
  }

  /** Next events on or after the current date. */
  get upcoming(): WorldEvent[] {
    return upcoming($state.snapshot(this.events), this.current, 5, DEFAULT_CONFIG);
  }

  /** Move the current date forward (or back) by `days`. */
  advanceBy(days: number): void {
    this.current = advance(this.current, days, DEFAULT_CONFIG);
    this.persist();
  }

  addEvent(date: WorldDate, title = 'New event'): WorldEvent {
    const ev: WorldEvent = { id: crypto.randomUUID(), date, title };
    this.events.push(ev);
    this.persist();
    return ev;
  }

  removeEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('calendar', { current: $state.snapshot(this.current), events: $state.snapshot(this.events) });
  }

  async load(): Promise<void> {
    const saved = await kvGet<CalState>('calendar');
    if (saved?.current) {
      this.current = saved.current;
      this.events = saved.events ?? [];
    }
  }
}

export const calendar = new CalendarStore();
