import { kvSet, kvGet } from '../../lib/db';
import {
  advanceTime,
  formatDateTime,
  formatClock,
  eventsForDay,
  upcoming,
  type WorldTime,
  type ScheduledEvent,
} from './logic';
import type { WorldDate } from '../calendar/logic';

export type { WorldTime, ScheduledEvent } from './logic';

interface SchedState {
  current: WorldTime;
  events: ScheduledEvent[];
}

const SEED: SchedState = {
  current: { day: 12, month: 5, year: 1492, hour: 8, minute: 0 },
  events: [
    { id: 'market', time: { day: 12, month: 5, year: 1492, hour: 9, minute: 0 }, title: 'Market opens' },
    { id: 'ritual', time: { day: 12, month: 5, year: 1492, hour: 18, minute: 30 }, title: 'Dusk ritual at the docks' },
  ],
};

/** Hour-resolution timeline: a current date+time and events pinned to times. */
class ScheduleStore {
  current = $state<WorldTime>({ ...SEED.current });
  events = $state<ScheduledEvent[]>(SEED.events.map((e) => ({ ...e, time: { ...e.time } })));

  get label(): string {
    return formatDateTime(this.current);
  }

  get clock(): string {
    return formatClock(this.current);
  }

  /** Events on the current day, earliest first. */
  get today(): ScheduledEvent[] {
    return eventsForDay($state.snapshot(this.events), this.current);
  }

  /** Next events at or after the current time. */
  get upcoming(): ScheduledEvent[] {
    return upcoming($state.snapshot(this.events), this.current, 5);
  }

  /** Move the clock forward (or back) by minutes, rolling days over. */
  advanceMinutes(minutes: number): void {
    this.current = advanceTime(this.current, minutes);
    this.persist();
  }

  setClock(hour: number, minute: number): void {
    const h = Math.min(23, Math.max(0, Math.floor(hour)));
    const m = Math.min(59, Math.max(0, Math.floor(minute)));
    this.current = { ...this.current, hour: h, minute: m };
    this.persist();
  }

  setDate(date: WorldDate): void {
    this.current = { ...this.current, ...date };
    this.persist();
  }

  addEvent(time: WorldTime, title = 'New event'): ScheduledEvent {
    const ev: ScheduledEvent = { id: crypto.randomUUID(), time: { ...time }, title };
    this.events.push(ev);
    this.persist();
    return ev;
  }

  updateEvent(id: string, patch: Partial<Omit<ScheduledEvent, 'id'>>): void {
    const ev = this.events.find((e) => e.id === id);
    if (ev) Object.assign(ev, patch);
    this.persist();
  }

  removeEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('schedule', {
      current: $state.snapshot(this.current),
      events: $state.snapshot(this.events),
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<SchedState>('schedule');
    if (saved?.current) {
      this.current = saved.current;
      this.events = saved.events ?? [];
    }
  }
}

export const schedule = new ScheduleStore();
