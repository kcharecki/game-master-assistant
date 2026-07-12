import { kvSet, kvGet } from '../../lib/db';
import {
  advanceTime,
  moonFraction,
  moonPhaseName,
  upcomingTimes,
  eventsForDay,
  formatDate,
  formatClock,
  clampDate,
  CALENDARS,
  MINUTES_PER_DAY,
  type WorldDate,
  type WorldTime,
  type ScheduledEvent,
  type MoonPhase,
  type CalendarId,
} from './logic';
import type { GameSystem } from '../../lib/system';

export type { WorldDate, WorldTime, ScheduledEvent, CalendarId } from './logic';

interface CalState {
  calId: CalendarId;
  current: WorldTime;
  events: ScheduledEvent[];
  touched: boolean;
}

/** Per-system default calendar + starting date (CoC → 1920s Gregorian). */
const DEFAULTS: Record<GameSystem, { calId: CalendarId; date: WorldTime }> = {
  coc7e: { calId: 'gregorian', date: { day: 15, month: 10, year: 1920, hour: 20, minute: 0 } },
  dnd5e: { calId: 'faerun', date: { day: 12, month: 5, year: 1492, hour: 8, minute: 0 } },
};

const SEED_EVENTS: ScheduledEvent[] = [
  { id: 'arrival', time: { day: 15, month: 10, year: 1920, hour: 21, minute: 0 }, title: 'Train arrives in Arkham' },
  { id: 'ritual', time: { day: 15, month: 10, year: 1920, hour: 23, minute: 30 }, title: 'Midnight ritual at the docks' },
];

/**
 * Merged in-world calendar + timeline: a current date & time, events pinned to
 * times, a selectable calendar preset, and a computed moon phase. Replaces the
 * old separate Calendar and Timeline stores.
 */
class CalendarStore {
  calId = $state<CalendarId>(DEFAULTS.coc7e.calId);
  current = $state<WorldTime>({ ...DEFAULTS.coc7e.date });
  events = $state<ScheduledEvent[]>(SEED_EVENTS.map((e) => ({ ...e, time: { ...e.time } })));
  /** True once the GM edits anything — stops the auto system-default override. */
  touched = $state(false);

  get config() {
    return CALENDARS[this.calId].config;
  }
  get calendarName(): string {
    return CALENDARS[this.calId].name;
  }
  /**
   * Moon phase name, derived from the same calId-aware `moonFraction` the
   * Desktop widget uses for its header/grid moons — keeps the GM widget and
   * the broadcast "date" tile in agreement for the same in-world date.
   */
  get moon(): MoonPhase {
    return moonPhaseName(moonFraction(this.current, this.calId));
  }
  /** Date only, e.g. "15 October, 1920". */
  get label(): string {
    return formatDate(this.current, this.config);
  }
  /** Time only, e.g. "20:00". */
  get clock(): string {
    return formatClock(this.current);
  }
  /** Events on the current day, earliest first. */
  get today(): ScheduledEvent[] {
    return eventsForDay($state.snapshot(this.events), this.current, this.config);
  }
  /** Next events at or after now, across days. */
  get upcoming(): ScheduledEvent[] {
    return upcomingTimes($state.snapshot(this.events), this.current, 5, this.config);
  }

  // --- navigation ----------------------------------------------------------
  advanceMinutes(minutes: number): void {
    this.current = advanceTime(this.current, minutes, this.config);
    this.touch();
  }
  advanceBy(days: number): void {
    this.advanceMinutes(days * MINUTES_PER_DAY);
  }
  /** Step whole months, keeping the time-of-day and clamping day to month length. */
  advanceMonths(k: number): void {
    const c = this.current;
    const total = c.year * 12 + (c.month - 1) + Math.trunc(k);
    const year = Math.floor(total / 12);
    const month = (((total % 12) + 12) % 12) + 1;
    this.current = clampDate({ ...c, year, month }, this.config);
    this.touch();
  }
  setClock(hour: number, minute: number): void {
    const h = Math.min(23, Math.max(0, Math.floor(hour)));
    const m = Math.min(59, Math.max(0, Math.floor(minute)));
    this.current = { ...this.current, hour: h, minute: m };
    this.touch();
  }
  setDate(date: Partial<WorldDate>): void {
    this.current = clampDate({ ...this.current, ...date }, this.config);
    this.touch();
  }
  setYear(year: number): void {
    this.setDate({ year: Number.isFinite(year) ? Math.floor(year) : this.current.year });
  }

  // --- calendar preset -----------------------------------------------------
  setCalendar(calId: CalendarId): void {
    this.calId = calId;
    this.current = clampDate(this.current, this.config);
    this.touch();
  }
  /** Apply the system's default calendar + date — unless the GM customized it. */
  useSystemDefault(system: GameSystem): void {
    if (this.touched) return;
    const d = DEFAULTS[system];
    this.calId = d.calId;
    this.current = { ...d.date };
    this.persist(); // persist but stay "untouched"
  }

  // --- events --------------------------------------------------------------
  addEvent(time: WorldTime, title = 'New event'): ScheduledEvent {
    const ev: ScheduledEvent = { id: crypto.randomUUID(), time: { ...time }, title };
    this.events.push(ev);
    this.touch();
    return ev;
  }
  updateEvent(id: string, patch: Partial<Omit<ScheduledEvent, 'id'>>): void {
    const ev = this.events.find((e) => e.id === id);
    if (ev) Object.assign(ev, patch);
    this.touch();
  }
  removeEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    this.touch();
  }

  private touch(): void {
    this.touched = true;
    this.persist();
  }

  persist(): void {
    void kvSet('calendar', {
      calId: this.calId,
      current: $state.snapshot(this.current),
      events: $state.snapshot(this.events),
      touched: this.touched,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<CalState>('calendar');
    if (!saved?.current) return;
    const c = saved.current as WorldTime & { hour?: number; minute?: number };
    this.calId = saved.calId ?? 'faerun'; // legacy saves predate presets
    this.current = { ...c, hour: c.hour ?? 0, minute: c.minute ?? 0 };
    // Legacy events were date-based ({ date, title }); pin them to midnight.
    this.events = (saved.events ?? []).map((e) => {
      const legacy = e as ScheduledEvent & { date?: WorldDate };
      if (legacy.time) return { ...legacy, time: { ...legacy.time } };
      const d = legacy.date ?? { day: this.current.day, month: this.current.month, year: this.current.year };
      return { id: legacy.id, title: legacy.title, time: { ...d, hour: 0, minute: 0 } };
    });
    this.touched = saved.touched ?? true; // legacy = treat as already customized
  }
}

export const calendar = new CalendarStore();
