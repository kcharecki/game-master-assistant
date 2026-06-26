import { createBus } from '../../lib/bus';
import { kvSet } from '../../lib/db';
import type { BroadcastPayload } from '../../lib/types';

/** Put the map (background + fog reveal grid) on air and mirror to kv. */
export function broadcastMap(src: string, reveal: number[][]): void {
  const payload: BroadcastPayload = { kind: 'map', src, reveal };
  const bus = createBus();
  bus.send(payload);
  bus.close();
  void kvSet('broadcastState', payload);
}
