import { createBus } from '../bus';
import { kvGet, kvSet } from '../db';
import type { BroadcastPayload } from '../types';
import { describeOnAir, type OnAirInfo } from '../onair';

/**
 * Global view of what the GM is currently broadcasting, for the topbar ON AIR
 * lamp. Rehydrates from kv on load and stays in sync by listening to the same
 * bus every module publishes to — so it reflects reveal/map/stage/etc. changes
 * without coupling to any one module.
 */
export class OnAirStore {
  payload = $state<BroadcastPayload | undefined>(undefined);
  #loaded = false;

  get info(): OnAirInfo {
    return describeOnAir(this.payload);
  }

  async load() {
    if (this.#loaded) return;
    this.#loaded = true;
    // Wire the bus BEFORE the async rehydrate so a push arriving during the
    // kvGet await isn't missed — and don't let the stale kv snapshot clobber it.
    let gotLive = false;
    // App-lifetime subscription (singleton store): never torn down.
    const bus = createBus();
    bus.on((msg) => {
      if (msg.type !== 'broadcast') return;
      const k = msg.payload.kind;
      // Transient overlays (ping/laser) and audio cues don't change on-air content.
      if (k === 'ping' || k === 'laser' || k === 'audio') return;
      gotLive = true;
      this.payload = msg.payload;
    });
    const saved = await kvGet<BroadcastPayload>('broadcastState');
    if (!gotLive) this.payload = saved;
  }

  /** Panic: black-screen the broadcast and clear the mirrored state. */
  clear() {
    const bus = createBus();
    bus.send({ kind: 'clear' });
    // stop any audio bed/SFX on the broadcast tab in the same breath.
    bus.send({ kind: 'audio', channel: 'ambient', action: 'panic' });
    bus.close();
    this.payload = { kind: 'clear' };
    void kvSet('broadcastState', { kind: 'clear' });
  }
}

export const onair = new OnAirStore();
