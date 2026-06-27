import { describe, it, expect } from 'vitest';
import {
  toMinuteIndex,
  fromMinuteIndex,
  advanceTime,
  formatClock,
  formatDateTime,
  eventsForDay,
  upcoming,
  type WorldTime,
  type ScheduledEvent,
} from './logic';

const base: WorldTime = { day: 12, month: 5, year: 1492, hour: 8, minute: 0 };

describe('minute index round-trip', () => {
  it('is invertible', () => {
    expect(fromMinuteIndex(toMinuteIndex(base))).toEqual(base);
  });
  it('encodes hour and minute', () => {
    const t: WorldTime = { ...base, hour: 14, minute: 5 };
    expect(toMinuteIndex(t) - toMinuteIndex({ ...base, hour: 0, minute: 0 })).toBe(14 * 60 + 5);
  });
});

describe('advanceTime', () => {
  it('rolls hours and days forward', () => {
    expect(advanceTime(base, 90)).toEqual({ ...base, hour: 9, minute: 30 });
    expect(advanceTime({ ...base, hour: 23, minute: 30 }, 60)).toEqual({
      ...base,
      day: 13,
      hour: 0,
      minute: 30,
    });
  });
  it('rewinds past midnight', () => {
    expect(advanceTime({ ...base, hour: 0, minute: 30 }, -60)).toEqual({
      ...base,
      day: 11,
      hour: 23,
      minute: 30,
    });
  });
});

describe('formatting', () => {
  it('pads the clock', () => {
    expect(formatClock({ ...base, hour: 9, minute: 5 })).toBe('09:05');
  });
  it('joins date and clock', () => {
    expect(formatDateTime({ ...base, hour: 14, minute: 0 })).toBe('12 Mirtul, 1492 · 14:00');
  });
});

describe('eventsForDay', () => {
  const evs: ScheduledEvent[] = [
    { id: 'b', time: { ...base, hour: 18, minute: 0 }, title: 'dusk ritual' },
    { id: 'a', time: { ...base, hour: 9, minute: 0 }, title: 'market opens' },
    { id: 'c', time: { ...base, day: 13, hour: 9, minute: 0 }, title: 'next day' },
  ];
  it('returns same-day events sorted by time', () => {
    expect(eventsForDay(evs, base).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('upcoming', () => {
  const evs: ScheduledEvent[] = [
    { id: 'past', time: { ...base, hour: 6, minute: 0 }, title: 'before now' },
    { id: 'soon', time: { ...base, hour: 10, minute: 0 }, title: 'later today' },
    { id: 'later', time: { ...base, day: 14, hour: 9, minute: 0 }, title: 'in two days' },
  ];
  it('drops past events and orders soonest first', () => {
    expect(upcoming(evs, base).map((e) => e.id)).toEqual(['soon', 'later']);
  });
});
