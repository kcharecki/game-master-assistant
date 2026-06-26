import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { npcs } from './store.svelte';

describe('NpcStore', () => {
  beforeEach(() => {
    for (const n of [...npcs.list]) npcs.remove(n.id);
  });

  it('adds an NPC with neutral defaults', () => {
    const n = npcs.add('Zadok Allen');
    expect(npcs.list).toHaveLength(1);
    expect(n.name).toBe('Zadok Allen');
    expect(n.disposition).toBe('neutral');
  });

  it('updates fields by id (read via store, not raw object)', () => {
    const n = npcs.add('Dock Worker');
    npcs.update(n.id, { disposition: 'hostile', voice: 'slurred' });
    const got = npcs.list.find((x) => x.id === n.id)!;
    expect(got.disposition).toBe('hostile');
    expect(got.voice).toBe('slurred');
  });

  it('removes by id', () => {
    const n = npcs.add('Throwaway');
    npcs.remove(n.id);
    expect(npcs.list).toHaveLength(0);
  });

  it('adds a generated NPC (deterministic via injected rng)', () => {
    const n = npcs.addGenerated(() => 0);
    expect(npcs.list).toHaveLength(1);
    expect(n.name).toBe('Bram Calloway');
    expect(n.disposition).toBe('neutral');
    expect(n.role.length).toBeGreaterThan(0);
    expect(n.voice).toContain(';');
  });
});
