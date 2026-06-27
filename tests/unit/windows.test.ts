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

  it('tile arranges visible windows into a non-overlapping grid within the viewport', () => {
    const VW = 1200;
    const VH = 800;
    const gap = 12;
    const pad = 12;
    for (let i = 0; i < 4; i++) wm.add('roller');
    wm.tile(VW, VH, gap, pad);

    const ws = wm.windows;
    expect(ws).toHaveLength(4);

    // 4 windows -> cols = ceil(sqrt(4)) = 2, rows = 2.
    const expectedW = Math.round((VW - pad * 2 - gap) / 2);
    const expectedH = Math.round((VH - pad * 2 - gap) / 2);
    for (const w of ws) {
      // Equal widths/heights for a perfect square grid.
      expect(w.w).toBe(expectedW);
      expect(w.h).toBe(expectedH);
      // Within viewport bounds.
      expect(w.x).toBeGreaterThanOrEqual(pad);
      expect(w.y).toBeGreaterThanOrEqual(pad);
      expect(w.x + w.w).toBeLessThanOrEqual(VW - pad + 1);
      expect(w.y + w.h).toBeLessThanOrEqual(VH - pad + 1);
    }

    // No two windows overlap.
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i];
        const b = ws[j];
        const overlap =
          a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlap).toBe(false);
      }
    }
  });

  it('tile skips minimized windows', () => {
    const a = wm.add('roller');
    const b = wm.add('scene');
    wm.toggleMin(b.id); // b is minimized -> skipped
    wm.move(b.id, 555, 444);
    wm.tile(1000, 1000);

    const got = (id: string) => wm.windows.find((x) => x.id === id)!;
    // Minimized window untouched.
    expect(got(b.id).x).toBe(555);
    expect(got(b.id).y).toBe(444);
    // Only visible window placed at the pad origin (single-cell grid).
    expect(got(a.id).x).toBe(12);
    expect(got(a.id).y).toBe(12);
  });
});
