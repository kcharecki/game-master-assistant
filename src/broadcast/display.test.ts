import { describe, it, expect } from 'vitest';
import { normalizeMode, nextMode, DEFAULT_DISPLAY_MODE } from './display';

describe('broadcast display mode', () => {
  it('passes through valid modes', () => {
    expect(normalizeMode('plain')).toBe('plain');
    expect(normalizeMode('cinematic')).toBe('cinematic');
  });

  it('falls back to the default for garbage / undefined', () => {
    expect(normalizeMode(undefined)).toBe(DEFAULT_DISPLAY_MODE);
    expect(normalizeMode('neon')).toBe(DEFAULT_DISPLAY_MODE);
    expect(normalizeMode(42)).toBe(DEFAULT_DISPLAY_MODE);
  });

  it('toggles between the two modes', () => {
    expect(nextMode('cinematic')).toBe('plain');
    expect(nextMode('plain')).toBe('cinematic');
  });
});
