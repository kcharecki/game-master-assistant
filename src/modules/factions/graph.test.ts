import { describe, it, expect } from 'vitest';
import { circleLayout, edgeGeometry, RELATION_COLOR, type NodePos } from './graph';

describe('circleLayout', () => {
  it('is empty for no ids', () => {
    expect(circleLayout([], 100, 100, 50)).toEqual([]);
  });

  it('centres a single node', () => {
    expect(circleLayout(['a'], 100, 100, 50)).toEqual([{ id: 'a', x: 100, y: 100 }]);
  });

  it('places the first node at the top (12 o’clock)', () => {
    const [top] = circleLayout(['a', 'b', 'c', 'd'], 100, 100, 50);
    expect(top.id).toBe('a');
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50); // cy - radius
  });

  it('spaces four nodes at the compass points', () => {
    const pts = circleLayout(['a', 'b', 'c', 'd'], 100, 100, 50);
    expect(pts[1].x).toBeCloseTo(150); // right (3 o'clock)
    expect(pts[1].y).toBeCloseTo(100);
    expect(pts[2].y).toBeCloseTo(150); // bottom (6 o'clock)
    expect(pts[3].x).toBeCloseTo(50); // left (9 o'clock)
  });
});

describe('edgeGeometry', () => {
  const positions: NodePos[] = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 100, y: 50 },
  ];

  it('returns endpoints, midpoint, and colour', () => {
    const g = edgeGeometry({ from: 'a', to: 'b', type: 'allied' }, positions);
    expect(g).not.toBeNull();
    expect(g!.a).toEqual({ x: 0, y: 0 });
    expect(g!.b).toEqual({ x: 100, y: 50 });
    expect(g!.mid).toEqual({ x: 50, y: 25 });
    expect(g!.color).toBe(RELATION_COLOR.allied);
  });

  it('returns null when an endpoint is missing', () => {
    expect(edgeGeometry({ from: 'a', to: 'z', type: 'hates' }, positions)).toBeNull();
  });
});
