export interface Track {
  id: string;
  /** asset id of the imported audio blob */
  assetId: string;
  label: string;
}

export interface Playlist {
  id: string;
  /** scene tag, e.g. 'tavern' | 'dungeon' | 'boss' */
  scene: string;
  tracks: Track[];
}

export interface Sfx {
  id: string;
  assetId: string;
  label: string;
}

/**
 * Crossfade volume envelope. Given elapsed/total ms, returns the gain for the
 * outgoing and incoming track (linear). Pure + clamped — unit-testable, no DOM.
 */
export function crossfadeGains(
  elapsedMs: number,
  durationMs: number
): { out: number; in: number } {
  if (durationMs <= 0) return { out: 0, in: 1 };
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return { out: 1 - t, in: t };
}

/** Index of the next track in a playlist, wrapping around. */
export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}
