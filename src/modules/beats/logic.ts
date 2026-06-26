export interface Beat {
  id: string;
  title: string;
  order: number;
}

/** Beats sorted by their order field. Pure — unit-tested, no DOM. */
export function ordered(beats: Beat[]): Beat[] {
  return [...beats].sort((a, b) => a.order - b.order);
}

/**
 * Move a beat one slot toward the start (-1) or end (+1), swapping order with
 * its neighbour. No-op at the boundary or for an unknown id. Returns a new
 * array with reassigned, gap-free order values (0..n-1).
 */
export function move(beats: Beat[], id: string, dir: -1 | 1): Beat[] {
  const seq = ordered(beats);
  const i = seq.findIndex((b) => b.id === id);
  if (i === -1) return seq.map((b, idx) => ({ ...b, order: idx }));
  const j = i + dir;
  if (j < 0 || j >= seq.length) return seq.map((b, idx) => ({ ...b, order: idx }));
  [seq[i], seq[j]] = [seq[j], seq[i]];
  return seq.map((b, idx) => ({ ...b, order: idx }));
}

/** Append a beat at the end with the next order value. */
export function add(beats: Beat[], title: string): Beat[] {
  const seq = ordered(beats);
  return [...seq.map((b, idx) => ({ ...b, order: idx })), { id: crypto.randomUUID(), title, order: seq.length }];
}

/** Remove a beat and re-pack order values. */
export function remove(beats: Beat[], id: string): Beat[] {
  return ordered(beats)
    .filter((b) => b.id !== id)
    .map((b, idx) => ({ ...b, order: idx }));
}
