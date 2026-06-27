export interface Track {
  id: string;
  /** asset id of the imported audio blob (omitted for YouTube tracks) */
  assetId?: string;
  /** 11-char YouTube video id; plays via an embedded iframe in the broadcast tab */
  youtubeId?: string;
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

/** Format seconds as `m:ss` (clamps NaN/negative to 0:00). Pure, DOM-free. */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Extract an 11-char YouTube video id from common URL forms, a bare id, or
 * return null for anything else. Handles watch?v=, youtu.be/, /embed/.
 */
export function parseYouTubeId(url: string): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  // Bare 11-char id (no scheme/host).
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed) && !trimmed.includes('/')) {
    return trimmed;
  }
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/, // watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})/, // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})/, // /embed/ID
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}
