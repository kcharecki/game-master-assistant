import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock kv so load()/persist() are pure. Real registry is used so getModule()
// resolves shipped module kinds (initiative, npcs, …).
const db = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('../db', () => ({ kvGet: db.get, kvSet: db.set }));

import { wm } from './windows.svelte';

beforeEach(() => {
  db.get.mockReset().mockResolvedValue(undefined);
  db.set.mockReset();
  wm.windows = [];
});

describe('wm.load — seed gating contract', () => {
  it('returns false when no layout was ever persisted (true first boot)', async () => {
    db.get.mockResolvedValue(undefined);
    expect(await wm.load()).toBe(false);
    expect(wm.windows).toHaveLength(0);
  });

  it('returns true when the GM emptied the desktop (persisted as [])', async () => {
    // sizes key -> undefined, windows key -> []
    db.get.mockImplementation((k: string) =>
      Promise.resolve(k === 'windows' ? [] : undefined),
    );
    expect(await wm.load()).toBe(true);
    expect(wm.windows).toHaveLength(0);
  });

  it('returns true and restores windows when a layout was persisted', async () => {
    const saved = [
      { id: 'a', kind: 'npcs', title: 'x', x: 1, y: 2, w: 300, h: 200, z: 11 },
    ];
    db.get.mockImplementation((k: string) =>
      Promise.resolve(k === 'windows' ? saved : undefined),
    );
    expect(await wm.load()).toBe(true);
    expect(wm.windows).toHaveLength(1);
    expect(wm.windows[0].kind).toBe('npcs');
    // older saves predate `collapsed`
    expect(wm.windows[0].collapsed).toBe(false);
  });
});
