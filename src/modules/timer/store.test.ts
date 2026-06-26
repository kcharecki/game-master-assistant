import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { TimerStore, formatClock } from './store.svelte';

describe('formatClock', () => {
  it('formats under and over an hour', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3661)).toBe('1:01:01');
  });
});

describe('TimerStore', () => {
  let t: TimerStore;
  beforeEach(() => {
    t = new TimerStore();
    t.breakEvery = 30;
  });

  it('only advances while running', () => {
    t.tick(10);
    expect(t.elapsed).toBe(0);
    t.start();
    t.tick(10);
    expect(t.elapsed).toBe(10);
    t.pause();
    t.tick(10);
    expect(t.elapsed).toBe(10);
  });

  it('reset clears elapsed and state', () => {
    t.start();
    t.tick(50);
    t.reset();
    expect(t.elapsed).toBe(0);
    expect(t.running).toBe(false);
    expect(t.breakDue).toBe(false);
  });

  it('flags a break when the interval is crossed, then ack restarts the window', () => {
    t.start();
    t.breakEvery = 1; // 60s
    expect(t.tick(59)).toBe(false);
    expect(t.breakDue).toBe(false);
    expect(t.tick(1)).toBe(true); // crosses 60s
    expect(t.breakDue).toBe(true);
    t.ackBreak();
    expect(t.breakDue).toBe(false);
    expect(t.tick(59)).toBe(false);
    expect(t.tick(1)).toBe(true); // next window
  });

  it('break reminder off when interval is 0', () => {
    t.start();
    t.breakEvery = 0;
    t.tick(100000);
    expect(t.breakDue).toBe(false);
  });

  it('tracks scene budget fraction and over-budget', () => {
    t.start();
    t.sceneBudget = 100;
    t.tick(50);
    expect(t.budgetFraction).toBeCloseTo(0.5);
    expect(t.overBudget).toBe(false);
    t.tick(60);
    expect(t.budgetFraction).toBe(1);
    expect(t.overBudget).toBe(true);
  });
});
