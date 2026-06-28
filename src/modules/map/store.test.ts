import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

import {
  map,
  snapToCell,
  clampZoom,
  GRID_SIZE,
  makeFog,
  serializeFog,
  normPing,
  fillFogRect,
  growFog,
  calibrationFactor,
  boxCalibration,
} from './store.svelte';

describe('grid math', () => {
  it('snaps a pixel coordinate to the nearest cell index', () => {
    expect(snapToCell(0)).toBe(0);
    expect(snapToCell(GRID_SIZE * 2 + 5)).toBe(2);
    expect(snapToCell(GRID_SIZE * 2 + GRID_SIZE / 2 + 1)).toBe(3); // rounds up past half
  });

  it('clamps zoom into 0.25..4', () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(10)).toBe(4);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('MapStore', () => {
  beforeEach(() => {
    for (const t of [...map.tokens]) map.removeToken(t.id);
    map.transform.panX = 0;
    map.transform.panY = 0;
    map.transform.zoom = 1;
  });

  it('adds a token at given cell with full hp', () => {
    const t = map.addToken(2, 5, 'Goblin');
    expect(map.tokens).toHaveLength(1);
    expect(t.gx).toBe(2);
    expect(t.gy).toBe(5);
    expect(t.hp).toBe(t.maxHp);
  });

  it('moves a token to a new cell', () => {
    const t = map.addToken(0, 0);
    map.moveToken(t.id, 7, 9);
    expect(map.tokens[0].gx).toBe(7);
    expect(map.tokens[0].gy).toBe(9);
  });

  it('removes a token by id', () => {
    const t = map.addToken();
    map.removeToken(t.id);
    expect(map.tokens).toHaveLength(0);
  });

  it('clamps hp between 0 and maxHp', () => {
    const t = map.addToken();
    map.setHp(t.id, -5);
    expect(map.tokens[0].hp).toBe(0);
    map.setHp(t.id, 999);
    expect(map.tokens[0].hp).toBe(t.maxHp);
  });

  it('toggles a condition on and off', () => {
    const t = map.addToken();
    map.toggleCondition(t.id, 'poisoned');
    expect(map.tokens[0].conditions).toContain('poisoned');
    map.toggleCondition(t.id, 'poisoned');
    expect(map.tokens[0].conditions).not.toContain('poisoned');
  });

  it('pans and zooms the transform', () => {
    map.pan(10, -4);
    expect(map.transform.panX).toBe(10);
    expect(map.transform.panY).toBe(-4);
    map.zoomBy(2);
    expect(map.transform.zoom).toBe(2);
    map.zoomBy(100); // clamped
    expect(map.transform.zoom).toBe(4);
  });
});

describe('fog of war', () => {
  beforeEach(() => map.clearFog());

  it('starts fully hidden', () => {
    const fog = makeFog(3, 2);
    expect(fog).toEqual([
      [false, false, false],
      [false, false, false],
    ]);
  });

  it('paints and erases a single cell', () => {
    map.setFog(2, 1, true);
    expect(map.fog[1][2]).toBe(true);
    map.setFog(2, 1, false);
    expect(map.fog[1][2]).toBe(false);
  });

  it('ignores out-of-bounds cells', () => {
    expect(() => map.setFog(-1, 0, true)).not.toThrow();
    expect(() => map.setFog(0, 9999, true)).not.toThrow();
  });

  it('serializes to a 0/1 grid for broadcast', () => {
    expect(serializeFog([[true, false]])).toEqual([[1, 0]]);
    map.setFog(0, 0, true);
    expect(map.fogPayload()[0][0]).toBe(1);
  });
});

describe('region reveal (fillFogRect)', () => {
  it('reveals every cell in a rectangle regardless of corner order', () => {
    const fog = makeFog(4, 4);
    fillFogRect(fog, 3, 2, 1, 1, true); // bottom-right -> top-left corners
    expect(fog[1][1]).toBe(true);
    expect(fog[2][3]).toBe(true);
    expect(fog[1][3]).toBe(true);
    expect(fog[0][0]).toBe(false); // outside
    expect(fog[3][3]).toBe(false); // outside
  });

  it('clamps the rectangle to the grid bounds', () => {
    const fog = makeFog(3, 3);
    expect(() => fillFogRect(fog, -5, -5, 99, 99, true)).not.toThrow();
    expect(fog.every((row) => row.every((c) => c))).toBe(true);
  });

  it('store.setFogRect reveals the region', () => {
    map.fog = makeFog(5, 5);
    map.setFogRect(1, 1, 2, 2, true);
    expect(map.fog[1][1]).toBe(true);
    expect(map.fog[2][2]).toBe(true);
    expect(map.fog[0][0]).toBe(false);
  });
});

describe('growFog', () => {
  it('grows to cover larger dimensions, preserving reveal state', () => {
    const fog = makeFog(2, 2);
    fog[0][0] = true;
    const grown = growFog(fog, 4, 3);
    expect(grown.length).toBe(3);
    expect(grown[0].length).toBe(4);
    expect(grown[0][0]).toBe(true);
    expect(grown[2][3]).toBe(false);
  });

  it('never shrinks below the current size', () => {
    const grown = growFog(makeFog(5, 5), 2, 2);
    expect(grown.length).toBe(5);
    expect(grown[0].length).toBe(5);
  });
});

describe('calibrationFactor + store calibration', () => {
  it('returns the factor that makes a line span N metres at 1 cell = 1 m', () => {
    // A 192px line the GM says is 2m -> 96 world-px/m; want GRID_SIZE(48)/m.
    expect(calibrationFactor(192, 2)).toBeCloseTo(GRID_SIZE / 96);
  });

  it('guards against non-positive input', () => {
    expect(calibrationFactor(0, 5)).toBe(1);
    expect(calibrationFactor(100, 0)).toBe(1);
  });

  it('calibrate adjusts bg scale so cells map to metres', () => {
    map.setBg('asset-1', 480, 480, 1); // natural 480px, scale 1
    // GM measures a 240px line and calls it 10m -> 24 world-px/m.
    map.calibrate(240, 10);
    expect(map.bg?.scale).toBeCloseTo(GRID_SIZE / 24);
    // background now spans ~ (480 * scale)/GRID_SIZE = 10m * (480/240) = 20 cells.
    expect(map.bgCells().cols).toBe(20);
    map.clearBg();
    expect(map.bg).toBeNull();
  });
});

describe('boxCalibration (grid sync)', () => {
  const prev = { scale: 1, dx: 0, dy: 0 };

  it('scales so the box spans the given square count', () => {
    // 100px-wide box = 2 squares, 50px-tall = 1 square -> ~0.96 px-per-natural.
    const r = boxCalibration({ x1: 10, y1: 10, x2: 110, y2: 60 }, 2, 1, prev);
    expect(r.scale).toBeCloseTo(GRID_SIZE / 50);
  });

  it('offsets so the box top-left lands on a cell boundary', () => {
    const box = { x1: 10, y1: 10, x2: 110, y2: 60 };
    const r = boxCalibration(box, 2, 1, prev);
    // box top-left in new world coords must sit on a grid line.
    const worldX = r.dx + 10 * r.scale;
    const worldY = r.dy + 10 * r.scale;
    expect(worldX % GRID_SIZE).toBeCloseTo(0);
    expect(worldY % GRID_SIZE).toBeCloseTo(0);
    expect(r.dx).toBeGreaterThanOrEqual(0);
    expect(r.dx).toBeLessThan(GRID_SIZE);
  });

  it('guards against degenerate input', () => {
    expect(boxCalibration({ x1: 5, y1: 5, x2: 5, y2: 5 }, 2, 2, prev)).toEqual(prev);
    expect(boxCalibration({ x1: 0, y1: 0, x2: 9, y2: 9 }, 0, 1, prev)).toEqual(prev);
  });

  it('store.calibrateBox aligns the printed grid to cells', () => {
    map.setBg('a', 400, 200, 1);
    map.calibrateBox({ x1: 0, y1: 0, x2: 100, y2: 100 }, 2, 2);
    // 100px / 2 squares -> 50px per square -> scale GRID_SIZE/50.
    expect(map.bg?.scale).toBeCloseTo(GRID_SIZE / 50);
    expect(map.bg?.dx).toBeCloseTo(0);
    map.clearBg();
  });
});

describe('broadcast frame (view)', () => {
  it('defaults to the background bounds, not the (possibly huge) fog grid', () => {
    map.clearView();
    map.fog = makeFog(60, 40, true); // oversized leftover grid
    map.setBg('a', 400, 200, 1); // 400x200 image at scale 1
    const v = map.broadcastView();
    expect(v).toEqual({ x: 0, y: 0, w: 400, h: 200 });
    map.clearBg();
  });

  it('uses an explicit frame when set, and normalises corners', () => {
    map.setView(120, 90, 20, 30);
    expect(map.view).toEqual({ x: 20, y: 30, w: 100, h: 60 });
    expect(map.broadcastView()).toEqual({ x: 20, y: 30, w: 100, h: 60 });
    map.clearView();
    expect(map.view).toBeNull();
  });

  it('ignores a stray (tiny) frame drag', () => {
    map.clearView();
    map.setView(10, 10, 11, 11);
    expect(map.view).toBeNull();
  });

  it('falls back to the fog grid when there is no background', () => {
    map.clearView();
    map.clearBg();
    map.fog = makeFog(5, 3, true);
    expect(map.broadcastView()).toEqual({ x: 0, y: 0, w: 5 * GRID_SIZE, h: 3 * GRID_SIZE });
  });
});

describe('normPing', () => {
  const rect = { left: 100, top: 50, width: 200, height: 400 };

  it('normalizes a point to 0..1 relative to bounds', () => {
    expect(normPing(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(normPing(100, 50, rect)).toEqual({ x: 0, y: 0 });
  });

  it('clamps points outside the bounds', () => {
    expect(normPing(0, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(normPing(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });

  it('avoids divide-by-zero on a zero-size rect', () => {
    expect(normPing(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});
