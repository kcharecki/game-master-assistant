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
