import type { BroadcastPayload } from './types';

/** What's currently on air, resolved to a small display record for the ON AIR lamp. */
export interface OnAirInfo {
  /** true when something player-visible is broadcasting (not idle/cleared). */
  live: boolean;
  /** short human label of the on-air content, or undefined when idle. */
  label?: string;
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
