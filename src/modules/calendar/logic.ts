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
