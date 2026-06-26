import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub IndexedDB persistence so the store is testable in jsdom.
vi.mock('../../src/lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { wm } from '../../src/lib/stores/windows.svelte';

describe('WindowManager', () => {
  beforeEach(() => {
    for (const w of [...wm.windows]) wm.close(w.id);
  });

  it('adds a window with defaults for its kind', () => {
    const w = wm.add('roller', 10, 20);
    expect(wm.windows).toHaveLength(1);
    expect(w.kind).toBe('roller');
    expect(w.title).toBe('Quick Roller');
    expect(w.x).toBe(10);
    expect(w.y).toBe(20);
  });

  it('raises z-index on focus', () => {
    const a = wm.add('scene');
    const b = wm.add('npcs');
    wm.focus(a.id);
    // Read via the store: $state holds proxies, not the raw returned objects.
    const za = wm.windows.find((w) => w.id === a.id)!.z;
    const zb = wm.windows.find((w) => w.id === b.id)!.z;
    expect(za).toBeGreaterThan(zb);
  });

  it('moves and closes windows', () => {
    const w = wm.add('handouts');
    wm.move(w.id, 99, 88);
    expect(wm.windows.find((x) => x.id === w.id)?.x).toBe(99);
    wm.close(w.id);
    expect(wm.windows).toHaveLength(0);
  });
});
