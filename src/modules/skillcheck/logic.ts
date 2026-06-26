import { rollDie, rollD100, rollOutcome, type RollOutcome } from '../roller/logic';
import type { GameSystem } from '../../lib/system';

/** A resolved D&D check: d20 + mod vs DC, with degree of margin. */
export interface D20Result {
  system: 'dnd5e';
  roll: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  /** total - dc (negative = how far short) */
  margin: number;
  /** natural 20 / natural 1 on the die */
  crit: boolean;
  fumble: boolean;
}

/** A resolved CoC check: d100 vs skill, with success tier. */
export interface D100Result {
  system: 'coc7e';
  roll: number;
  skill: number;
  outcome: RollOutcome;
  success: boolean;
}

export type CheckResult = D20Result | D100Result;

/** D&D 5e: roll d20 + modifier vs a difficulty class. */
export function checkDnd(
  modifier: number,
  dc: number,
  rng: () => number = Math.random
): D20Result {
  const roll = rollDie(20, rng);
  const total = roll + modifier;
  return {
    system: 'dnd5e',
    roll,
    modifier,
    total,
    dc,
    success: total >= dc,
    margin: total - dc,
    crit: roll === 20,
    fumble: roll === 1,
  };
}

/** CoC 7e: roll d100 vs a skill rating; tiers via the shared roller logic. */
export function checkCoc(skill: number, rng: () => number = Math.random): D100Result {
  const roll = rollD100(rng);
  const outcome = rollOutcome(roll, skill);
  return {
    system: 'coc7e',
    roll,
    skill,
    outcome,
    success: outcome === 'Extreme Success' || outcome === 'Regular Success',
  };
}

/**
 * System-tuned resolver. For D&D `target` is the DC and `value` the modifier;
 * for CoC `value` is the skill rating (`target` ignored).
 */
export function check(
  system: GameSystem,
  value: number,
  target: number,
  rng: () => number = Math.random
): CheckResult {
  return system === 'dnd5e' ? checkDnd(value, target, rng) : checkCoc(value, rng);
}
