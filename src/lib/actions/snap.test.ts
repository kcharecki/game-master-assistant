import { describe, it, expect } from 'vitest';
import { collectGuides, snapRect, type Rect } from './snap';

describe('collectGuides', () => {
  it('includes viewport frame + neighbour edges', () => {
    const g = collectGuides(1000, 800, [{ x: 100, y: 50, w: 200, h: 150 }]);
    expect(g.xs).toEqual([0, 1000, 100, 300]);
    expect(g.ys).toEqual([0, 800, 50, 200]);
  });
});

describe('snapRect', () => {
  const guides = collectGuides(1000, 800, [{ x: 400, y: 300, w: 200, h: 100 }]);

  it('snaps left edge to screen edge when near', () => {
    const r: Rect = { x: 5, y: 200, w: 300, h: 200 };
    expect(snapRect(r, guides, 8)).toEqual({ x: 0, y: 200 });
  });

  it('snaps right edge to screen right', () => {
    const r: Rect = { x: 695, y: 200, w: 300, h: 200 }; // right edge at 995, within 8 of 1000
    expect(snapRect(r, guides, 8)).toEqual({ x: 700, y: 200 });
  });

  it('snaps to a neighbour window left edge', () => {
    const r: Rect = { x: 396, y: 100, w: 100, h: 80 };
    expect(snapRect(r, guides, 8).x).toBe(400);
  });

  it('snaps top and bottom to neighbour edges', () => {
    const r: Rect = { x: 50, y: 296, w: 100, h: 80 }; // top near 300
    expect(snapRect(r, guides, 8).y).toBe(300);
    const r2: Rect = { x: 50, y: 224, w: 100, h: 80 }; // bottom at 304, near 300
    expect(snapRect(r2, guides, 8).y).toBe(220);
  });

  it('leaves position unchanged when nothing is within threshold', () => {
    const r: Rect = { x: 123, y: 456, w: 100, h: 80 };
    expect(snapRect(r, guides, 8)).toEqual({ x: 123, y: 456 });
  });

  it('prefers the left edge over the right when both are in range', () => {
    // narrow window whose both edges sit near two guides; left should win
    const g = collectGuides(400, 400, []); // xs: 0, 400
    const r: Rect = { x: 3, y: 100, w: 394, h: 80 }; // left near 0 (3), right near 400 (397 -> 3)
    expect(snapRect(r, g, 8).x).toBe(0);
  });
});
