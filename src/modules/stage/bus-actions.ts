import { createBus } from '../../lib/bus';
import type { BroadcastPayload } from '../../lib/types';

/**
 * Move/show or hide the laser pointer on the broadcast. Transient + live-only:
 * sent over the bus with no kv mirror, so it never clobbers the on-air content.
 */
export function sendLaser(x: number, y: number, on: boolean): void {
  const payload: BroadcastPayload = { kind: 'laser', x, y, on };
  const bus = createBus();
  bus.send(payload);
  bus.close();
}
