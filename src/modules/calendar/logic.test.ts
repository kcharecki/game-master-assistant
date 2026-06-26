import { describe, it, expect } from 'vitest';
import {
  toDayIndex,
  fromDayIndex,
  advance,
  moonPhase,
  upcoming,
  formatDate,
  daysPerYear,
  DEFAULT_CONFIG,
  type WorldDate,
  type WorldEvent,
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
});
