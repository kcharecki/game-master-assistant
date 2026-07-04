export interface Track {
  id: string;
  /** asset id of the imported audio blob (omitted for YouTube tracks) */
  assetId?: string;
  /** 11-char YouTube video id; plays via an embedded iframe in the broadcast tab */
  youtubeId?: string;
  label: string;
  /** per-track gain trim 0..1 (defaults to 1) so loud/quiet imports can be levelled */
  gain?: number;
  /** track length in seconds, read from metadata on import (undefined for YouTube) */
  duration?: number;
}

export interface Scene {
  id: string;
  /** display name, e.g. 'Tavern' | 'Dungeon' | 'Boss Fight' */
  name: string;
  tracks: Track[];
  /** per-scene gain trim 0..1 (defaults to 1) */
  gain?: number;
}

/** How the ambient queue repeats. Maps to the two wire booleans loopList/loopTrack. */
export type RepeatMode = 'off' | 'scene' | 'track';

/** Derive the UI repeat mode from the two stored booleans. */
export function repeatMode(loopList: boolean, loopTrack: boolean): RepeatMode {
  if (loopTrack) return 'track';
  return loopList ? 'scene' : 'off';
}

/** Map a UI repeat mode back to the two wire booleans. */
export function repeatFlags(mode: RepeatMode): { loopList: boolean; loopTrack: boolean } {
  switch (mode) {
    case 'track':
      return { loopList: true, loopTrack: true };
    case 'scene':
      return { loopList: true, loopTrack: false };
    default:
      return { loopList: false, loopTrack: false };
  }
}

export interface Sfx {
  id: string;
  assetId: string;
  label: string;
  /** optional board group, e.g. 'combat' | 'ambient' | 'voice' */
  group?: string;
  /** per-sfx gain trim 0..1 (defaults to 1) */
  gain?: number;
}

/** Move the item at `from` to `to` in a copy of `arr` (bounds-clamped). Pure. */
export function reorder<T>(arr: T[], from: number, to: number): T[] {
  const out = arr.slice();
  if (from < 0 || from >= out.length) return out;
  const t = Math.min(Math.max(0, to), out.length - 1);
  const [item] = out.splice(from, 1);
  out.splice(t, 0, item);
  return out;
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

/**
 * Resolve the next ambient index for the sequencer. `dir` is +1 (advance) or -1
 * (previous). `loopList` wraps past the ends; without it, stepping off either end
 * returns -1 ("stop"). `loopTrack` repeats the current index regardless of dir.
 * Pure + bounds-safe — the broadcast engine's only branching logic.
 */
export function advanceIndex(
  current: number,
  length: number,
  opts: { loopTrack?: boolean; loopList?: boolean } = {},
  dir: 1 | -1 = 1
): number {
  if (length <= 0) return -1;
  if (opts.loopTrack) return Math.min(Math.max(0, current), length - 1);
  const next = current + dir;
  if (next >= 0 && next < length) return next;
  if (opts.loopList) return ((next % length) + length) % length;
  return -1;
}

/** Multiply a set of 0..1 gain factors into one clamped channel volume. */
export function effectiveVolume(...factors: number[]): number {
  let v = 1;
  for (const f of factors) v *= Number.isFinite(f) ? f : 1;
  return Math.min(1, Math.max(0, v));
}

/**
 * Perceptual volume curve (squared). Human loudness perception is roughly
 * logarithmic, so a linear slider crams all the useful range into the top.
 * Squaring gives a usable low end (10% slider ≈ 1% output). Pure + clamped.
 */
export function perceptual(v: number): number {
  const c = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return c * c;
}

/**
 * Fisher–Yates shuffle into a copy. `rand` is injectable for deterministic
 * tests; defaults to Math.random. Pure (does not mutate `arr`).
 */
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
