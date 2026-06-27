import { describe, it, expect } from 'vitest';
import { translate, messages } from './index';

describe('translate', () => {
  it('returns the Polish string when present', () => {
    expect(translate('mod.map.title', 'pl')).toBe('Mapa bitwy');
  });

  it('falls back to English when the key is missing in Polish', () => {
    // Inject an en-only key to exercise the en fallback path deterministically.
    const key = '__test.enOnly__';
    messages.en[key] = 'English only';
    try {
      expect(translate(key, 'pl')).toBe('English only');
    } finally {
      delete messages.en[key];
    }
  });

  it('falls back to the raw key when unknown in both locales', () => {
    expect(translate('totally.unknown.key', 'pl')).toBe('totally.unknown.key');
    expect(translate('totally.unknown.key', 'en')).toBe('totally.unknown.key');
  });

  it('has distinct en/pl values for a real title key', () => {
    expect(translate('mod.initiative.title', 'en')).toBe('Initiative Tracker');
    expect(translate('mod.initiative.title', 'pl')).toBe('Licznik inicjatywy');
    expect(translate('mod.initiative.title', 'en')).not.toBe(
      translate('mod.initiative.title', 'pl'),
    );
  });
});
