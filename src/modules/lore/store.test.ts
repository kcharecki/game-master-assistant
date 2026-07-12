import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { lore } from './store.svelte';
import { toast } from '../../lib/stores/toast.svelte';

/** Capture the undo closure of the toast currently shown by the last remove(). */
const lastUndo = (): (() => void) => {
  const fn = toast.current?.undoFn;
  if (!fn) throw new Error('expected an undoable toast to be active');
  return fn;
};

describe('LoreStore', () => {
  beforeEach(() => {
    for (const p of [...lore.pages]) lore.remove(p.id);
  });

  it('adds a page and selects it', () => {
    const p = lore.add('New Page');
    expect(lore.pages).toHaveLength(1);
    expect(lore.selected?.id).toBe(p.id);
  });

  it('updates fields by id', () => {
    const p = lore.add('Title');
    lore.update(p.id, { body: 'Body text' });
    expect(lore.pages.find((x) => x.id === p.id)?.body).toBe('Body text');
  });

  it('removes by id', () => {
    const p = lore.add('Throwaway');
    lore.remove(p.id);
    expect(lore.pages).toHaveLength(0);
  });

  it('undo immediately after remove (no intervening edits) restores the page at its original index', () => {
    const a = lore.add('A');
    const b = lore.add('B');
    const c = lore.add('C');
    lore.remove(b.id);
    const undoB = lastUndo();
    expect(lore.pages.map((p) => p.id)).toEqual([a.id, c.id]);
    undoB();
    expect(lore.pages.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
  });

  it('undo after an intervening add restores the page before its original neighbor, not at a stale index', () => {
    const a = lore.add('A');
    const b = lore.add('B');
    const c = lore.add('C');
    lore.remove(b.id); // pages: [a, c]; b's neighbor-after was c
    const undoB = lastUndo();

    const d = lore.add('D'); // intervening mutation: pages: [a, c, d]
    expect(() => undoB()).not.toThrow();

    // Restored relative to its original neighbor (before c), not spliced at the
    // stale numeric index 1 (which would have landed it between c and d).
    expect(lore.pages.map((p) => p.id)).toEqual([a.id, b.id, c.id, d.id]);
  });

  it('undo after the original neighbor was also removed falls back to appending, staying in-bounds', () => {
    const a = lore.add('A');
    const b = lore.add('B');
    const c = lore.add('C');
    lore.remove(b.id); // neighbor-after was c
    const undoB = lastUndo();

    lore.remove(c.id); // intervening mutation removes that neighbor too: pages: [a]
    expect(() => undoB()).not.toThrow();

    const ids = lore.pages.map((p) => p.id);
    expect(ids).toEqual([a.id, b.id]);
  });

  it('undo of the last page (no neighbor-after) appends at the end after intervening edits', () => {
    const a = lore.add('A');
    const b = lore.add('B');
    lore.remove(b.id); // pages: [a]; no neighbor-after
    const undoB = lastUndo();

    const c = lore.add('C'); // pages: [a, c]
    expect(() => undoB()).not.toThrow();
    expect(lore.pages.map((p) => p.id)).toEqual([a.id, c.id, b.id]);
  });
});
