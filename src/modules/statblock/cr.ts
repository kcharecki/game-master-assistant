/** D&D 5e encounter difficulty math (XP budget). */

export type Difficulty = 'Trivial' | 'Easy' | 'Medium' | 'Hard' | 'Deadly';

/** XP value for a Challenge Rating (DMG monster XP-by-CR table). */
const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
};

export function xpForCr(cr: string): number {
  return CR_XP[cr] ?? 0;
}

/** Per-character XP thresholds by level (DMG): easy/medium/hard/deadly. */
const THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
};

export interface PartyThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

/** Sum per-character thresholds for a party of `size` characters at `level`. */
export function partyThresholds(size: number, level: number): PartyThresholds {
  const lvl = Math.min(10, Math.max(1, Math.round(level)));
  const [e, m, h, d] = THRESHOLDS[lvl];
  const n = Math.max(0, Math.round(size));
  return { easy: e * n, medium: m * n, hard: h * n, deadly: d * n };
}

/**
 * Encounter multiplier by monster count (DMG). More monsters → effective XP
 * is higher because action economy favours the larger side.
 */
export function encounterMultiplier(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

/** Adjusted XP = raw XP * action-economy multiplier. */
export function adjustedXp(crs: string[]): number {
  const raw = crs.reduce((sum, cr) => sum + xpForCr(cr), 0);
  return Math.round(raw * encounterMultiplier(crs.length));
}

/** Classify adjusted XP against party thresholds. */
export function difficulty(adjusted: number, t: PartyThresholds): Difficulty {
  if (adjusted >= t.deadly) return 'Deadly';
  if (adjusted >= t.hard) return 'Hard';
  if (adjusted >= t.medium) return 'Medium';
  if (adjusted >= t.easy) return 'Easy';
  return 'Trivial';
}

export interface EncounterReadout {
  rawXp: number;
  adjustedXp: number;
  multiplier: number;
  thresholds: PartyThresholds;
  difficulty: Difficulty;
}

/** One-shot: given monster CRs and party shape, compute the full readout. */
export function evaluateEncounter(
  crs: string[],
  partySize: number,
  partyLevel: number
): EncounterReadout {
  const rawXp = crs.reduce((sum, cr) => sum + xpForCr(cr), 0);
  const multiplier = encounterMultiplier(crs.length);
  const adj = Math.round(rawXp * multiplier);
  const thresholds = partyThresholds(partySize, partyLevel);
  return {
    rawXp,
    adjustedXp: adj,
    multiplier,
    thresholds,
    difficulty: difficulty(adj, thresholds),
  };
}
