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

  const get = (id: string) => npcs.list.find((x) => x.id === id)!;

  it('adds, updates, and removes equipment by id', () => {
    const n = npcs.add('Smuggler');
    const item = npcs.addEquip(n.id, 'Dagger')!;
    expect(get(n.id).equipment).toHaveLength(1);
    npcs.updateEquip(n.id, item.id, { qty: 2, notes: 'rusty' });
    const e = get(n.id).equipment!.find((x) => x.id === item.id)!;
    expect(e.qty).toBe(2);
    expect(e.notes).toBe('rusty');
    npcs.removeEquip(n.id, item.id);
    expect(get(n.id).equipment).toHaveLength(0);
  });

  it('adds photos to the gallery and seeds portraitId from the first', () => {
    const n = npcs.add('Faceless');
    npcs.addPhoto(n.id, 'a1');
    expect(get(n.id).gallery).toEqual(['a1']);
    expect(get(n.id).portraitId).toBe('a1');
    npcs.addPhoto(n.id, 'a2');
    expect(get(n.id).gallery).toEqual(['a1', 'a2']);
    // first stays primary
    expect(get(n.id).portraitId).toBe('a1');
    // no duplicates
    npcs.addPhoto(n.id, 'a2');
    expect(get(n.id).gallery).toEqual(['a1', 'a2']);
  });

  it('sets a primary photo (adding it to the gallery if needed)', () => {
    const n = npcs.add('Portrait');
    npcs.addPhoto(n.id, 'a1');
    npcs.setPrimaryPhoto(n.id, 'a3');
    expect(get(n.id).portraitId).toBe('a3');
    expect(get(n.id).gallery).toContain('a3');
  });

  it('removing the primary photo promotes the next gallery photo', () => {
    const n = npcs.add('Shifter');
    npcs.addPhoto(n.id, 'a1');
    npcs.addPhoto(n.id, 'a2');
    npcs.removePhoto(n.id, 'a1');
    expect(get(n.id).gallery).toEqual(['a2']);
    expect(get(n.id).portraitId).toBe('a2');
    npcs.removePhoto(n.id, 'a2');
    expect(get(n.id).gallery).toEqual([]);
    expect(get(n.id).portraitId).toBeUndefined();
  });

  it('adds, updates, and removes stat rows by id', () => {
    const n = npcs.add('Statted');
    const row = npcs.addStat(n.id)!;
    expect(get(n.id).stats).toHaveLength(1);
    npcs.updateStat(n.id, row.id, { key: 'AC', val: '14' });
    const s = get(n.id).stats!.find((x) => x.id === row.id)!;
    expect(s.key).toBe('AC');
    expect(s.val).toBe('14');
    npcs.removeStat(n.id, row.id);
    expect(get(n.id).stats).toHaveLength(0);
  });
});
