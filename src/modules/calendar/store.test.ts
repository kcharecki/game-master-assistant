import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { calendar } from './store.svelte';
import { moonFraction, moonPhaseName } from './logic';

describe('CalendarStore', () => {
  beforeEach(() => {
    calendar.calId = 'gregorian';
    calendar.current = { day: 15, month: 10, year: 1920, hour: 20, minute: 0 };
    calendar.events = [];
    calendar.touched = false;
  });

  describe('setYear', () => {
    it('accepts 0 — year 0 is a valid year, not a falsy sentinel', () => {
      calendar.setYear(0);
      expect(calendar.current.year).toBe(0);
    });

    it('floors fractional years', () => {
      calendar.setYear(1923.7);
      expect(calendar.current.year).toBe(1923);
    });

    it('falls back to the current year only for non-finite input', () => {
      const before = calendar.current.year;
      calendar.setYear(NaN);
      expect(calendar.current.year).toBe(before);
    });
  });

  describe('moon', () => {
    it('agrees with moonPhaseName(moonFraction(current, calId)) — the same function the Desktop widget uses', () => {
      calendar.setDate({ year: 1920, month: 10, day: 15 });
      expect(calendar.moon).toBe(moonPhaseName(moonFraction(calendar.current, calendar.calId)));
    });

    it('stays in agreement after switching calendars and dates (faerun)', () => {
      calendar.setCalendar('faerun');
      calendar.setDate({ year: 1492, month: 5, day: 12 });
      expect(calendar.moon).toBe(moonPhaseName(moonFraction(calendar.current, calendar.calId)));
    });

    it('stays in agreement across a run of advanced dates', () => {
      for (let i = 0; i < 10; i++) {
        calendar.advanceBy(3);
        expect(calendar.moon).toBe(moonPhaseName(moonFraction(calendar.current, calendar.calId)));
      }
    });
  });
});
