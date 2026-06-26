import { rollDie, type DiceSpec } from '../roller/logic';

/** A SAN-loss spec like "1/1d6": pass loss on success, fail loss on failure. */
export interface SanLossSpec {
  /** loss on a successful SAN roll, e.g. "1" or "0" */
  pass: string;
  /** loss on a failed SAN roll, e.g. "1d6" or "1d10" */
  fail: string;
}

/** Lose >= this much SAN in a single roll → bout of madness (CoC 7e). */
export const BOUT_THRESHOLD = 5;

/** Parse "pass/fail" (e.g. "1/1d6"). Returns null if malformed. */
export function parseSanLoss(input: string): SanLossSpec | null {
  const m = /^\s*([^/]+?)\s*\/\s*(.+?)\s*$/.exec(input);
  if (!m) return null;
  return { pass: m[1], fail: m[2] };
}

/** Roll a single side of a SAN-loss spec ("0", "2", "1d6", "2d6+1"). */
function rollLoss(expr: string, rng: () => number): number {
  const m = /^\s*(\d*)\s*(?:d\s*(\d+))?\s*([+-]\s*\d+)?\s*$/i.exec(expr);
  if (!m || (!m[1] && !m[2])) return 0;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
  if (!m[2]) return Math.max(0, count + mod); // flat number
  const sides = parseInt(m[2], 10);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += rollDie(sides, rng);
  return Math.max(0, sum + mod);
}

export interface SanLossResult {
  /** the d100 SAN check roll */
  roll: number;
  /** did the SAN check succeed (roll <= current SAN)? */
  success: boolean;
  /** SAN points lost */
  loss: number;
  /** SAN after applying the loss (floored at 0) */
  remaining: number;
  /** lost >= BOUT_THRESHOLD in one go */
  bout: boolean;
}

/**
 * Quick SAN-loss roll. Rolls d100 vs current SAN; on success applies the
 * smaller `pass` loss, on failure the larger `fail` loss. Rng injectable.
 */
export function sanLossRoll(
  current: number,
  spec: SanLossSpec,
  rng: () => number = Math.random
): SanLossResult {
  const roll = 1 + Math.floor(rng() * 100);
  const success = roll <= current;
  const loss = rollLoss(success ? spec.pass : spec.fail, rng);
  const remaining = Math.max(0, current - loss);
  return { roll, success, loss, remaining, bout: loss >= BOUT_THRESHOLD };
}

export type { DiceSpec };
