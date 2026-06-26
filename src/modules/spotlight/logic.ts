/** A player tracked for spotlight time. `last` is a ms timestamp, or 0 = never. */
export interface Player {
  id: string;
  name: string;
  last: number;
}

export interface SpotlightRow extends Player {
  /** ms since last meaningful moment (Infinity if never) */
  sinceMs: number;
  /** overdue relative to the configured threshold */
  overdue: boolean;
}

/**
 * Sort players most-overdue first and flag those past the threshold.
 * `now` and `thresholdMs` are injected for deterministic tests.
 * Pure — unit-tested, no DOM.
 */
export function spotlightRows(players: Player[], now: number, thresholdMs: number): SpotlightRow[] {
  return players
    .map((p) => {
      const sinceMs = p.last > 0 ? now - p.last : Infinity;
      return { ...p, sinceMs, overdue: sinceMs >= thresholdMs };
    })
    .sort((a, b) => {
      // Compare by recency, treating "never" (Infinity) as most overdue.
      // Avoid Infinity-Infinity = NaN by comparing with sign, not subtraction.
      if (a.sinceMs !== b.sinceMs) return a.sinceMs > b.sinceMs ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
