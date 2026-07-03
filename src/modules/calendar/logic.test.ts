import { describe, it, expect } from 'vitest';
import {
  toDayIndex,
  fromDayIndex,
  advance,
  moonPhase,
  upcoming,
  formatDate,
  daysPerYear,
  clampDate,
  DEFAULT_CONFIG,
  GREGORIAN_CONFIG,
  toMinuteIndex,
  fromMinuteIndex,
  advanceTime,
  formatClock,
  formatDateTime,
  eventsForDay,
  upcomingTimes,
  type WorldDate,
  type WorldEvent,
  type WorldTime,
  type ScheduledEvent,
} from './logic';

const d = (day: number, month: number, year: number): WorldDate => ({ day, month, year });

describe('day index round-trip', () => {
  it('has 360 days per default year', () => {
    expect(daysPerYear(DEFAULT_CONFIG)).toBe(360);
  });

  it('maps the epoch to 0', () => {
    expect(toDayIndex(d(1, 1, 0))).toBe(0);
  });

  it('counts months and years', () => {
    expect(toDayIndex(d(1, 2, 0))).toBe(30); // start of month 2
    expect(toDayIndex(d(1, 1, 1))).toBe(360); // start of year 1
    expect(toDayIndex(d(12, 5, 1492))).toBe(1492 * 360 + 4 * 30 + 11);
  });

  it('is invertible', () => {
    for (const idx of [0, 1, 29, 30, 359, 360, 537119]) {
      expect(toDayIndex(fromDayIndex(idx))).toBe(idx);
    }
  });
});

describe('advance', () => {
  it('rolls over month boundaries', () => {
    expect(advance(d(30, 1, 1492), 1)).toEqual(d(1, 2, 1492));
  });
  it('rolls over year boundaries', () => {
    expect(advance(d(30, 12, 1492), 1)).toEqual(d(1, 1, 1493));
  });
  it('rewinds with negatives', () => {
    expect(advance(d(1, 2, 1492), -1)).toEqual(d(30, 1, 1492));
  });
});

describe('moonPhase', () => {
  it('is New Moon at the epoch and every 28 days', () => {
    expect(moonPhase(d(1, 1, 0))).toBe('New Moon');
    expect(moonPhase(advance(d(1, 1, 0), 28))).toBe('New Moon');
  });
  it('is Full Moon at the half-cycle (day 14)', () => {
    expect(moonPhase(advance(d(1, 1, 0), 14))).toBe('Full Moon');
  });
});

describe('upcoming', () => {
  const events: WorldEvent[] = [
    { id: 'a', date: d(5, 1, 1492), title: 'Past' },
    { id: 'b', date: d(20, 1, 1492), title: 'Soon' },
    { id: 'c', date: d(1, 3, 1492), title: 'Later' },
  ];
  it('returns future events soonest-first, excluding the past', () => {
    const got = upcoming(events, d(10, 1, 1492));
    expect(got.map((e) => e.id)).toEqual(['b', 'c']);
  });
  it('honours the limit', () => {
    expect(upcoming(events, d(1, 1, 1492), 1).map((e) => e.id)).toEqual(['a']);
  });
});

describe('formatDate', () => {
  it('uses the month name', () => {
    expect(formatDate(d(12, 5, 1492))).toBe('12 Mirtul, 1492');
  });
  it('formats a Gregorian date (CoC 1920)', () => {
    expect(formatDate(d(15, 10, 1920), GREGORIAN_CONFIG)).toBe('15 October, 1920');
  });
});

describe('gregorian config', () => {
  it('has 365 days (leap years ignored)', () => {
    expect(daysPerYear(GREGORIAN_CONFIG)).toBe(365);
  });
});

describe('clampDate', () => {
  it('clamps a day past the month length', () => {
    // Faerûn day 40 → 30; Gregorian Feb 31 → 28.
    expect(clampDate(d(40, 1, 1492), DEFAULT_CONFIG)).toEqual(d(30, 1, 1492));
    expect(clampDate({ day: 31, month: 2, year: 1920 }, GREGORIAN_CONFIG)).toEqual({
      day: 28,
      month: 2,
      year: 1920,
    });
  });
  it('preserves extra fields (hour/minute)', () => {
    const t: WorldTime = { day: 5, month: 1, year: 1920, hour: 9, minute: 15 };
    expect(clampDate(t, GREGORIAN_CONFIG)).toEqual(t);
  });
});

// --- time layer (merged from the former Timeline module) ---
const base: WorldTime = { day: 12, month: 5, year: 1492, hour: 8, minute: 0 };

describe('minute index round-trip', () => {
  it('is invertible and encodes hour/minute', () => {
    expect(fromMinuteIndex(toMinuteIndex(base))).toEqual(base);
    expect(toMinuteIndex({ ...base, hour: 14, minute: 5 }) - toMinuteIndex({ ...base, hour: 0, minute: 0 })).toBe(
      14 * 60 + 5,
    );
  });
});

describe('advanceTime', () => {
  it('rolls days forward and rewinds past midnight', () => {
    expect(advanceTime({ ...base, hour: 23, minute: 30 }, 60)).toEqual({ ...base, day: 13, hour: 0, minute: 30 });
    expect(advanceTime({ ...base, hour: 0, minute: 30 }, -60)).toEqual({ ...base, day: 11, hour: 23, minute: 30 });
  });
});

describe('clock formatting', () => {
  it('pads and joins', () => {
    expect(formatClock({ ...base, hour: 9, minute: 5 })).toBe('09:05');
    expect(formatDateTime({ ...base, hour: 14, minute: 0 })).toBe('12 Mirtul, 1492 · 14:00');
  });
});

describe('eventsForDay & upcomingTimes', () => {
  const evs: ScheduledEvent[] = [
    { id: 'b', time: { ...base, hour: 18, minute: 0 }, title: 'dusk' },
    { id: 'a', time: { ...base, hour: 9, minute: 0 }, title: 'market' },
    { id: 'c', time: { ...base, day: 13, hour: 9, minute: 0 }, title: 'next day' },
  ];
  it('returns same-day events sorted by time', () => {
    expect(eventsForDay(evs, base).map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('lists upcoming across days, soonest first', () => {
    expect(upcomingTimes(evs, { ...base, hour: 10, minute: 0 }).map((e) => e.id)).toEqual(['b', 'c']);
  });
});
