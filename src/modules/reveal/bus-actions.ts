import { createBus } from '../../lib/bus';
import { kvSet } from '../../lib/db';
import type { BroadcastPayload } from '../../lib/types';

/**
 * Put a payload on air: send over the channel + mirror to IndexedDB for rehydrate.
 * Bus is opened lazily per call so importing this module has no side effects (testable).
 */
export function putOnAir(payload: BroadcastPayload): void {
  const bus = createBus();
  bus.send(payload);
  bus.close();
  void kvSet('broadcastState', payload);
}

export function clearBroadcast(): void {
  putOnAir({ kind: 'clear' });
}
