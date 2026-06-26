import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { sanity } from './store.svelte';

describe('SanityStore', () => {
  beforeEach(() => {
    for (const i of [...sanity.list]) sanity.remove(i.id);
    sanity.last = null;
  });

  it('adds an investigator with default SAN', () => {
    const i = sanity.add('Cpt. Henslowe');
    expect(sanity.list).toHaveLength(1);
    expect(i.san).toBe(50);
  });

  it('applies SAN loss and records the result', () => {
    const i = sanity.add('Doomed');
    sanity.update(i.id, { san: 60, maxSan: 60 });
    const r = sanity.rollLoss(i.id, '1/1d6', () => 0); // success → lose 1
    expect(r?.loss).toBe(1);
    expect(sanity.list.find((x) => x.id === i.id)!.san).toBe(59);
    expect(sanity.last?.id).toBe(i.id);
  });

  it('returns null for a bad spec', () => {
    const i = sanity.add('Safe');
    expect(sanity.rollLoss(i.id, 'garbage', () => 0)).toBeNull();
  });
});
