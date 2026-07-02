import { createBus } from '../../lib/bus';
import { kvSet } from '../../lib/db';
import type { BroadcastPayload } from '../../lib/types';

/**
 * Put the map (background + fog reveal grid) on air and mirror to kv.
 * Uploaded backgrounds travel as `assetId` (blob: URLs don't resolve cross-tab);
 * external image URLs travel as `src`.
 */
export function broadcastMap(
  reveal: number[][],
  ref: {
    assetId?: string;
    src?: string;
    grid?: 'square' | 'hex' | 'none';
    tokens?: {
      gx: number;
      gy: number;
      label: string;
      color: string;
      conditions?: string[];
      size?: number;
    }[];
    img?: { x: number; y: number; w: number; h: number };
    view?: { x: number; y: number; w: number; h: number };
  } = {}
): void {
  const payload: BroadcastPayload = { kind: 'map', reveal, ...ref };
  const bus = createBus();
  bus.send(payload);
  bus.close();
  void kvSet('broadcastState', payload);
}

/**
 * Flash a transient ping at normalized (x,y). Sent over the bus and mirrored to
 * its OWN kv key — never `broadcastState`, so it can't clobber the on-air view.
 */
export function broadcastPing(x: number, y: number): void {
  const payload: BroadcastPayload = { kind: 'ping', x, y };
  const bus = createBus();
  bus.send(payload);
  bus.close();
  void kvSet('broadcastPing', payload);
}
