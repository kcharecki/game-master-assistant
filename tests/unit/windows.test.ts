import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub IndexedDB persistence so the store is testable in jsdom.
vi.mock('../../src/lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import { kvSet } from '../../src/lib/db';
import { wm } from '../../src/lib/stores/windows.svelte';

describe('WindowManager', () => {
  beforeEach(() => {
    for (const w of [...wm.windows]) wm.close(w.id);
    vi.clearAllMocks();
  });

  it('adds a window with defaults for its kind', () => {
    const w = wm.add('roller', 10, 20);
    expect(wm.windows).toHaveLength(1);
    expect(w.kind).toBe('roller');
    expect(w.title).toBe('Quick Roller');
    expect(w.x).toBe(10);
    expect(w.y).toBe(20);
    expect(w.collapsed).toBe(false);
  });

  it('toggleCollapse flips collapsed state without moving the window and persists', () => {
    const w = wm.add('roller', 10, 20);
    const got = () => wm.windows.find((x) => x.id === w.id)!;
    expect(got().collapsed).toBe(false);

    wm.toggleCollapse(w.id);
    expect(got().collapsed).toBe(true);
    // geometry untouched by collapse
    expect(got().x).toBe(10);
    expect(got().y).toBe(20);
    expect(kvSet).toHaveBeenCalledWith('windows', expect.anything());

    wm.toggleCollapse(w.id);
    expect(got().collapsed).toBe(false);
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

  it('resizes windows and clamps to minimums', () => {
    const w = wm.add('roller');
    wm.resize(w.id, 400, 300);
    const got = () => wm.windows.find((x) => x.id === w.id)!;
    expect(got().w).toBe(400);
    expect(got().h).toBe(300);
    wm.resize(w.id, 10, 10); // below minimums
    expect(got().w).toBe(200);
    expect(got().h).toBe(120);
  });
});
