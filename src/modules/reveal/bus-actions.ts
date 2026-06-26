import { createBus } from '../../lib/bus';
import { kvSet } from '../../lib/db';
import type { BroadcastPayload, DisplayMode } from '../../lib/types';
import { DISPLAY_MODE_KEY } from '../../broadcast/display';

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

/** Change how the broadcast page frames content; mirror to kv for rehydrate. */
export function setDisplayMode(mode: DisplayMode): void {
  const bus = createBus();
  bus.sendDisplay(mode);
  bus.close();
  void kvSet(DISPLAY_MODE_KEY, mode);
}
