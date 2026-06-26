import { describe, it, expect } from 'vitest';
import { crossfadeGains, nextIndex } from './logic';

describe('crossfadeGains', () => {
  it('starts fully on the outgoing track', () => {
    expect(crossfadeGains(0, 1000)).toEqual({ out: 1, in: 0 });
  });

  it('is balanced at the midpoint', () => {
    expect(crossfadeGains(500, 1000)).toEqual({ out: 0.5, in: 0.5 });
  });

  it('ends fully on the incoming track', () => {
    expect(crossfadeGains(1000, 1000)).toEqual({ out: 0, in: 1 });
  });

  it('clamps past the end and handles zero duration', () => {
    expect(crossfadeGains(5000, 1000)).toEqual({ out: 0, in: 1 });
    expect(crossfadeGains(10, 0)).toEqual({ out: 0, in: 1 });
  });
});

describe('nextIndex', () => {
  it('advances and wraps around', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('is safe on an empty list', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});
