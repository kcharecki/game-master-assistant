/**
 * Player-facing display mode: how the broadcast page *frames* whatever the GM
 * sends. This is purely presentational — it never carries GM-private data, so
 * it is mirrored to its own kv key separate from the broadcast payload.
 */
export type DisplayMode = 'cinematic' | 'plain';

export const DISPLAY_MODE_KEY = 'broadcastDisplayMode';
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'cinematic';

/** Narrow an unknown (e.g. rehydrated) value to a valid mode, with a safe default. */
export function normalizeMode(value: unknown): DisplayMode {
  return value === 'plain' || value === 'cinematic' ? value : DEFAULT_DISPLAY_MODE;
}

/** Cycle to the next mode (GM toggle). */
export function nextMode(mode: DisplayMode): DisplayMode {
  return mode === 'cinematic' ? 'plain' : 'cinematic';
}
