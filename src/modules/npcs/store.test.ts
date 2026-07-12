import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { npcs } from './store.svelte';
import { loc } from '../../lib/loc';
import { toast } from '../../lib/stores/toast.svelte';

/** Capture the undo closure of the toast currently shown by the last remove(). */
const lastUndo = (): (() => void) => {
  const fn = toast.current?.undoFn;
  if (!fn) throw new Error('expected an undoable toast to be active');
  return fn;
};

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

  it('undo immediately after remove (no intervening edits) restores the NPC at its original index', () => {
    const a = npcs.add('A');
    const b = npcs.add('B');
    const c = npcs.add('C');
    npcs.remove(b.id);
    const undoB = lastUndo();
    expect(npcs.list.map((x) => x.id)).toEqual([a.id, c.id]);
    undoB();
    expect(npcs.list.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
  });

  it('undo after an intervening add restores the NPC before its original neighbor, not at a stale index', () => {
    const a = npcs.add('A');
    const b = npcs.add('B');
    const c = npcs.add('C');
    npcs.remove(b.id); // list: [a, c]; b's neighbor-after was c
    const undoB = lastUndo();

    const d = npcs.add('D'); // intervening mutation: list: [a, c, d]
    expect(() => undoB()).not.toThrow();

    // Restored relative to its original neighbor (before c), not spliced at the
    // stale numeric index 1 (which would have landed it between c and d).
    expect(npcs.list.map((x) => x.id)).toEqual([a.id, b.id, c.id, d.id]);
  });

  it('undo after the original neighbor was also removed falls back to appending, staying in-bounds', () => {
    const a = npcs.add('A');
    const b = npcs.add('B');
    const c = npcs.add('C');
    npcs.remove(b.id); // neighbor-after was c
    const undoB = lastUndo();

    npcs.remove(c.id); // intervening mutation removes that neighbor too: list: [a]
    expect(() => undoB()).not.toThrow();

    expect(npcs.list.map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('adds a generated NPC (deterministic via injected rng)', () => {
    const n = npcs.addGenerated(() => 0);
    expect(npcs.list).toHaveLength(1);
    expect(n.name).toBe('Bram Calloway');
    expect(n.disposition).toBe('neutral');
    expect(loc(n.role, 'en').length).toBeGreaterThan(0);
    expect(loc(n.voice, 'en')).toContain(';');
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

  it('adds, updates, and removes attack rows by id', () => {
    const n = npcs.add('Mummy');
    const row = npcs.addAttack(n.id)!;
    expect(get(n.id).attacks).toHaveLength(1);
    npcs.updateAttack(n.id, row.id, { name: 'Fighting', chance: '70%', damage: '1d6+DB' });
    const a = get(n.id).attacks!.find((x) => x.id === row.id)!;
    expect(a.name).toBe('Fighting');
    expect(a.chance).toBe('70%');
    expect(a.damage).toBe('1d6+DB');
    npcs.removeAttack(n.id, row.id);
    expect(get(n.id).attacks).toHaveLength(0);
  });

  it('adds, updates, and removes skill rows by id', () => {
    const n = npcs.add('Sneak');
    const row = npcs.addSkill(n.id)!;
    expect(get(n.id).skills).toHaveLength(1);
    npcs.updateSkill(n.id, row.id, { name: 'Stealth', value: '50%' });
    const s = get(n.id).skills!.find((x) => x.id === row.id)!;
    expect(s.name).toBe('Stealth');
    expect(s.value).toBe('50%');
    npcs.removeSkill(n.id, row.id);
    expect(get(n.id).skills).toHaveLength(0);
  });

  it('attaches and detaches spell references (deduped)', () => {
    const n = npcs.add('Sorcerer');
    npcs.attachSpell(n.id, 'spl-1');
    npcs.attachSpell(n.id, 'spl-1'); // dupe ignored
    npcs.attachSpell(n.id, 'spl-2');
    expect(get(n.id).spellIds).toEqual(['spl-1', 'spl-2']);
    npcs.detachSpell(n.id, 'spl-1');
    expect(get(n.id).spellIds).toEqual(['spl-2']);
  });
});
