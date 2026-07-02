import type { BroadcastPayload } from '../types';
import { pushHistory, type OnAirEntry } from '../onair';

/** How many past on-air payloads to remember for one-click re-air. */
export const HISTORY_LIMIT = 12;

/**
 * GM-side ring buffer of recently-aired payloads (most-recent-first). Populated
 * by `putOnAir` on every broadcast so the GM can re-air a previous scene/handout
 * with one click. Transient overlays (ping/laser/audio) and clears are skipped.
 * Lives only in memory (session-scoped); not mirrored to kv.
 */
class OnAirHistory {
  entries = $state<OnAirEntry[]>([]);

  /** Record a freshly-aired payload; no-op for non-content payloads. */
  record(payload: BroadcastPayload): void {
    const entry: OnAirEntry = { id: crypto.randomUUID(), at: Date.now(), payload };
    this.entries = pushHistory($state.snapshot(this.entries) as OnAirEntry[], entry, HISTORY_LIMIT);
  }

  clear(): void {
    this.entries = [];
  }
}

export const onairHistory = new OnAirHistory();
