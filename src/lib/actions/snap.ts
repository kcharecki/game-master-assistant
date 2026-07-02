/**
 * Pure window snap-to-edges + magnetism math. Given a proposed window rect,
 * the viewport size, and the edges of *other* windows, nudge the window so its
 * edges align with nearby edges (screen or neighbour) within a threshold.
 * No DOM — unit-tested.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Vertical guide lines (x positions) and horizontal guide lines (y positions). */
export interface Guides {
  xs: number[];
  ys: number[];
}

/**
 * Collect candidate snap lines from the viewport frame and every other window.
 * X lines: left edge, right edge of screen + each neighbour's left/right.
 * Y lines: top, bottom of screen + each neighbour's top/bottom. Pure.
 */
export function collectGuides(viewportW: number, viewportH: number, others: Rect[]): Guides {
  const xs = [0, viewportW];
  const ys = [0, viewportH];
  for (const o of others) {
    xs.push(o.x, o.x + o.w);
    ys.push(o.y, o.y + o.h);
  }
  return { xs, ys };
}

/** Nearest guide to `value` within `threshold`, or null. Pure helper. */
function nearest(value: number, guides: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestD = threshold + 1;
  for (const g of guides) {
    const d = Math.abs(value - g);
    if (d <= threshold && d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

/**
 * Snap a rect's position so its left/right edges hug the nearest vertical guide
 * and its top/bottom edges hug the nearest horizontal guide, within `threshold`
 * px. Size is preserved (right/bottom snaps translate to an x/y shift). The
 * left/top edge wins over right/bottom when both are in range on an axis.
 * Returns the (possibly unchanged) x/y. Pure — unit-tested.
 */
export function snapRect(rect: Rect, guides: Guides, threshold = 8): { x: number; y: number } {
  let { x, y } = rect;

  // X axis: try left edge, then right edge.
  const leftG = nearest(x, guides.xs, threshold);
  if (leftG !== null) {
    x = leftG;
  } else {
    const rightG = nearest(x + rect.w, guides.xs, threshold);
    if (rightG !== null) x = rightG - rect.w;
  }

  // Y axis: try top edge, then bottom edge.
  const topG = nearest(y, guides.ys, threshold);
  if (topG !== null) {
    y = topG;
  } else {
    const bottomG = nearest(y + rect.h, guides.ys, threshold);
    if (bottomG !== null) y = bottomG - rect.h;
  }

  return { x: Math.round(x), y: Math.round(y) };
}
