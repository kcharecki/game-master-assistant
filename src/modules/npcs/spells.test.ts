import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { spellLibrary } from './spells.svelte';

describe('SpellLibrary', () => {
  beforeEach(() => {
    for (const s of [...spellLibrary.list]) spellLibrary.remove(s.id);
  });

  it('adds, gets, updates, and removes a spell', () => {
    const s = spellLibrary.add('Contact Deity');
    expect(spellLibrary.get(s.id)?.name).toBe('Contact Deity');
    spellLibrary.update(s.id, { cost: '1d3 Magic Points', castingTime: '1 hour' });
    expect(spellLibrary.get(s.id)?.cost).toBe('1d3 Magic Points');
    expect(spellLibrary.get(s.id)?.castingTime).toBe('1 hour');
    spellLibrary.remove(s.id);
    expect(spellLibrary.get(s.id)).toBeUndefined();
  });
});
