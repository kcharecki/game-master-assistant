import type { BroadcastPayload } from './types';

/** What's currently on air, resolved to a small display record for the ON AIR lamp. */
export interface OnAirInfo {
  /** true when something player-visible is broadcasting (not idle/cleared). */
  live: boolean;
  /** short human label of the on-air content, or undefined when idle. */
  label?: string;
}

/** One remembered on-air payload, with a stable id + timestamp for the history list. */
export interface OnAirEntry {
  id: string;
  at: number;
  payload: BroadcastPayload;
}

/** Payload kinds worth remembering: real on-air content, not transient overlays. */
function isHistoryWorthy(p: BroadcastPayload): boolean {
  return p.kind !== 'clear' && p.kind !== 'ping' && p.kind !== 'laser' && p.kind !== 'audio';
}

/**
 * Pure ring-buffer push: prepend `entry` (most-recent-first) and keep at most `n`.
 * Non-history-worthy payloads (clear/overlays/audio) return the list unchanged.
 */
export function pushHistory(list: OnAirEntry[], entry: OnAirEntry, n: number): OnAirEntry[] {
  if (!isHistoryWorthy(entry.payload)) return list;
  return [entry, ...list].slice(0, Math.max(0, n));
}

/**
 * Pure helper: describe whatever payload is currently on air.
 * `clear` (and undefined) mean nothing is broadcasting. Transient overlays
 * (ping/laser/audio) never replace the on-air content, so they report idle.
 */
export function describeOnAir(p: BroadcastPayload | undefined): OnAirInfo {
  if (!p || p.kind === 'clear') return { live: false };
  switch (p.kind) {
    case 'text':
      return { live: true, label: p.title || (p.body ? p.body.slice(0, 40) : 'Text') };
    case 'image':
      return { live: true, label: p.caption || 'Image' };
    case 'map':
      return { live: true, label: 'Battle map' };
    case 'grid':
      return { live: true, label: 'Stage' };
    case 'roll':
      return { live: true, label: p.label || 'Dice roll' };
    // ping / laser / audio are transient overlays or side-channels — not on-air content.
    default:
      return { live: false };
  }
}
