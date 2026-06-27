import {
  toDayIndex,
  fromDayIndex,
  formatDate,
  DEFAULT_CONFIG,
  type WorldDate,
  type CalendarConfig,
} from '../calendar/logic';

/** A point in time: an in-world date plus an hour (0-23) and minute (0-59). */
export interface WorldTime extends WorldDate {
  hour: number;
  minute: number;
}

/** An event pinned to a specific in-world time. */
export interface ScheduledEvent {
  id: string;
  time: WorldTime;
  title: string;
  note?: string;
}

export const MINUTES_PER_DAY = 1440;

/** Absolute minute index since {year 0, month 1, day 1, 00:00}. */
export function toMinuteIndex(t: WorldTime, cfg: CalendarConfig = DEFAULT_CONFIG): number {
  return toDayIndex(t, cfg) * MINUTES_PER_DAY + t.hour * 60 + t.minute;
}

/** Inverse of toMinuteIndex. Handles negative indices (rewinding past midnight). */
export function fromMinuteIndex(index: number, cfg: CalendarConfig = DEFAULT_CONFIG): WorldTime {
  const dayIdx = Math.floor(index / MINUTES_PER_DAY);
  const rem = index - dayIdx * MINUTES_PER_DAY; // always 0..1439 since dayIdx is floored
  const d = fromDayIndex(dayIdx, cfg);
  return { ...d, hour: Math.floor(rem / 60), minute: rem % 60 };
}

/** Advance (or rewind) a time by a number of minutes, rolling days over. */
export function advanceTime(
  t: WorldTime,
  minutes: number,
  cfg: CalendarConfig = DEFAULT_CONFIG
): WorldTime {
  return fromMinuteIndex(toMinuteIndex(t, cfg) + minutes, cfg);
}

export function sameDay(a: WorldDate, b: WorldDate): boolean {
  return a.day === b.day && a.month === b.month && a.year === b.year;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "14:05" */
export function formatClock(t: WorldTime): string {
  return `${pad2(t.hour)}:${pad2(t.minute)}`;
}

/** "12 Mirtul, 1492 · 14:05" */
export function formatDateTime(t: WorldTime, cfg: CalendarConfig = DEFAULT_CONFIG): string {
  return `${formatDate(t, cfg)} · ${formatClock(t)}`;
}

/** Events on a given date, earliest first. */
export function eventsForDay(
  events: ScheduledEvent[],
  date: WorldDate,
  cfg: CalendarConfig = DEFAULT_CONFIG
): ScheduledEvent[] {
  return events
    .filter((e) => sameDay(e.time, date))
    .sort((a, b) => toMinuteIndex(a.time, cfg) - toMinuteIndex(b.time, cfg));
}

/** Next events at or after `from`, soonest first, capped at `limit`. */
export function upcoming(
  events: ScheduledEvent[],
  from: WorldTime,
  limit = 5,
  cfg: CalendarConfig = DEFAULT_CONFIG
): ScheduledEvent[] {
  const f = toMinuteIndex(from, cfg);
  return events
    .map((e) => ({ e, i: toMinuteIndex(e.time, cfg) }))
    .filter((x) => x.i >= f)
    .sort((a, b) => a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}
