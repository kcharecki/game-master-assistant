/**
 * Flat-top hex-grid overlay geometry. Pure + DOM-free so the broadcast map can
 * draw a hex lattice as a single SVG path, and so it's unit-testable.
 *
 * Hexes are sized to roughly one square cell: `size` is the centre-to-corner
 * radius. Flat-top hexes have width `2·size` and height `√3·size`; columns step
 * by `1.5·size` horizontally with alternate columns offset half a row down.
 */
export function hexGridPath(cols: number, rows: number, cell: number): string {
  const size = cell / 1.5;
  const h = Math.sqrt(3) * size;
  const colStep = 1.5 * size;
  // Cover the whole cols×cell × rows×cell area (plus a margin column/row).
  const nCols = Math.ceil((cols * cell) / colStep) + 1;
  const nRows = Math.ceil((rows * cell) / h) + 1;
  const parts: string[] = [];
  for (let c = 0; c < nCols; c++) {
    const cx = c * colStep + size;
    for (let r = 0; r < nRows; r++) {
      const cy = r * h + (c % 2 ? h / 2 : 0) + h / 2;
      parts.push(hexCorners(cx, cy, size));
    }
  }
  return parts.join(' ');
}

/** One flat-top hexagon's path segment (M…Z) centred at (cx,cy) with radius `size`. */
function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}
