/** A date in the custom in-world calendar (1-based day & month). */
export interface WorldDate {
  day: number;
  month: number;
  year: number;
}

export interface WorldEvent {
  id: string;
  date: WorldDate;
  title: string;
}

/** Calendar shape: month names + days each. Default is a tidy 12×30 year. */
export interface CalendarConfig {
  months: { name: string; days: number }[];
}

export const DEFAULT_CONFIG: CalendarConfig = {
  months: [
    { name: 'Hammer', days: 30 },
    { name: 'Alturiak', days: 30 },
    { name: 'Ches', days: 30 },
    { name: 'Tarsakh', days: 30 },
    { name: 'Mirtul', days: 30 },
    { name: 'Kythorn', days: 30 },
    { name: 'Flamerule', days: 30 },
    { name: 'Eleasis', days: 30 },
    { name: 'Eleint', days: 30 },
    { name: 'Marpenoth', days: 30 },
    { name: 'Uktar', days: 30 },
    { name: 'Nightal', days: 30 },
  ],
};

/** Real-world months. Leap years are ignored (Feb = 28) so every year is 365
 * days — this keeps the equal-length-year index math valid, which is plenty for
 * a GM tool tracking non-fantasy settings like Call of Cthulhu's 1920s. */
export const GREGORIAN_CONFIG: CalendarConfig = {
  months: [
    { name: 'January', days: 31 },
    { name: 'February', days: 28 },
    { name: 'March', days: 31 },
    { name: 'April', days: 30 },
    { name: 'May', days: 31 },
    { name: 'June', days: 30 },
    { name: 'July', days: 31 },
    { name: 'August', days: 31 },
    { name: 'September', days: 30 },
    { name: 'October', days: 31 },
    { name: 'November', days: 30 },
    { name: 'December', days: 31 },
  ],
};

export type CalendarId = 'faerun' | 'gregorian';

/** Selectable calendar presets (label + month layout). */
export const CALENDARS: Record<CalendarId, { name: string; config: CalendarConfig }> = {
  faerun: { name: 'Faerûn (Harptos, 12×30)', config: DEFAULT_CONFIG },
  gregorian: { name: 'Gregorian (Jan–Dec)', config: GREGORIAN_CONFIG },
};

/** Total days in a year for a config. */
export function daysPerYear(cfg: CalendarConfig): number {
  return cfg.months.reduce((s, m) => s + m.days, 0);
}

/**
 * Absolute day index (0-based) since {year 0, month 1, day 1}. Used for moon
 * phase and chronological ordering. Years assumed equal length.
 */
export function toDayIndex(d: WorldDate, cfg: CalendarConfig = DEFAULT_CONFIG): number {
  const yearDays = daysPerYear(cfg);
  let idx = d.year * yearDays;
  for (let m = 0; m < d.month - 1; m++) idx += cfg.months[m]?.days ?? 0;
  return idx + (d.day - 1);
}

/** Inverse of toDayIndex: an absolute day index back to a WorldDate. */
export function fromDayIndex(index: number, cfg: CalendarConfig = DEFAULT_CONFIG): WorldDate {
  const yearDays = daysPerYear(cfg);
  const year = Math.floor(index / yearDays);
  let rem = index - year * yearDays;
  let month = 1;
  for (const m of cfg.months) {
    if (rem < m.days) break;
    rem -= m.days;
    month++;
  }
  return { day: rem + 1, month, year };
}

/** Advance (or rewind) a date by a number of days. */
export function advance(d: WorldDate, days: number, cfg: CalendarConfig = DEFAULT_CONFIG): WorldDate {
  return fromDayIndex(toDayIndex(d, cfg) + days, cfg);
}

export const MOON_PHASES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

export type MoonPhase = (typeof MOON_PHASES)[number];

/** Length of the lunar cycle in days (8 phases × ~3.5 days). */
export const LUNAR_CYCLE = 28;

/** Moon phase for a date, from its absolute day index over a 28-day cycle. */
export function moonPhase(d: WorldDate, cfg: CalendarConfig = DEFAULT_CONFIG): MoonPhase {
  const idx = ((toDayIndex(d, cfg) % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE;
  const phase = Math.floor(idx / (LUNAR_CYCLE / MOON_PHASES.length));
  return MOON_PHASES[phase];
}

/** Events on or after `from`, soonest first, capped at `limit`. */
export function upcoming(
  events: WorldEvent[],
  from: WorldDate,
  limit = 5,
  cfg: CalendarConfig = DEFAULT_CONFIG
): WorldEvent[] {
  const fromIdx = toDayIndex(from, cfg);
  return events
    .map((e) => ({ e, idx: toDayIndex(e.date, cfg) }))
    .filter((x) => x.idx >= fromIdx)
    .sort((a, b) => a.idx - b.idx)
    .slice(0, limit)
    .map((x) => x.e);
}

/** Format a date with its month name, e.g. "12 Mirtul, 1492". */
export function formatDate(d: WorldDate, cfg: CalendarConfig = DEFAULT_CONFIG): string {
  const name = cfg.months[d.month - 1]?.name ?? `Month ${d.month}`;
  return `${d.day} ${name}, ${d.year}`;
}

/** Clamp a date so month and day are valid for `cfg` (used when switching calendars). */
export function clampDate<T extends WorldDate>(d: T, cfg: CalendarConfig): T {
  const month = Math.min(cfg.months.length, Math.max(1, d.month));
  const maxDay = cfg.months[month - 1]?.days ?? 30;
  const day = Math.min(maxDay, Math.max(1, d.day));
  return { ...d, month, day };
}

// ---------------------------------------------------------------------------
// Time layer: a WorldDate plus hour+minute, and events pinned to a time.
// (Merged in from the former Timeline module.)
// ---------------------------------------------------------------------------

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
export function advanceTime(t: WorldTime, minutes: number, cfg: CalendarConfig = DEFAULT_CONFIG): WorldTime {
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
  cfg: CalendarConfig = DEFAULT_CONFIG,
): ScheduledEvent[] {
  return events
    .filter((e) => sameDay(e.time, date))
    .sort((a, b) => toMinuteIndex(a.time, cfg) - toMinuteIndex(b.time, cfg));
}

/** Next events at or after `from`, soonest first, capped at `limit`. */
export function upcomingTimes(
  events: ScheduledEvent[],
  from: WorldTime,
  limit = 5,
  cfg: CalendarConfig = DEFAULT_CONFIG,
): ScheduledEvent[] {
  const f = toMinuteIndex(from, cfg);
  return events
    .map((e) => ({ e, i: toMinuteIndex(e.time, cfg) }))
    .filter((x) => x.i >= f)
    .sort((a, b) => a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}
