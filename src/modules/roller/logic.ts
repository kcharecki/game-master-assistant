export type RollOutcome = 'Extreme Success' | 'Regular Success' | 'Failure' | 'Fumble';

/** Call of Cthulhu d100 success tiers (skill threshold assumed 50 for the demo). */
export function rollOutcome(roll: number, skill = 50): RollOutcome {
  if (roll <= Math.floor(skill / 5)) return 'Extreme Success';
  if (roll <= skill) return 'Regular Success';
  if (roll >= 96) return 'Fumble';
  return 'Failure';
}

export function rollD100(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * 100);
}

/** Roll a single die with `sides` faces. */
export function rollDie(sides: number, rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * sides);
}

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
}

/** Parse `NdM+K` / `dM` / `NdM-K` (whitespace tolerant). Returns null if malformed. */
export function parseDice(input: string): DiceSpec | null {
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(input);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
  if (count < 1 || sides < 1) return null;
  return { count, sides, modifier };
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface RollResult {
  /** individual die faces rolled */
  rolls: number[];
  /** kept faces after advantage/disadvantage selection */
  kept: number[];
  modifier: number;
  total: number;
  /** GM-only: never put on the broadcast bus */
  hidden: boolean;
}

/**
 * Roll a parsed spec. `mode` only applies to single-die specs (e.g. 1d20):
 * advantage rolls twice and keeps the higher, disadvantage the lower.
 */
export function rollDice(
  spec: DiceSpec,
  mode: RollMode = 'normal',
  hidden = false,
  rng: () => number = Math.random
): RollResult {
  if (mode !== 'normal' && spec.count === 1) {
    const a = rollDie(spec.sides, rng);
    const b = rollDie(spec.sides, rng);
    const kept = mode === 'advantage' ? Math.max(a, b) : Math.min(a, b);
    return {
      rolls: [a, b],
      kept: [kept],
      modifier: spec.modifier,
      total: kept + spec.modifier,
      hidden,
    };
  }
  const rolls: number[] = [];
  for (let i = 0; i < spec.count; i++) rolls.push(rollDie(spec.sides, rng));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, kept: rolls, modifier: spec.modifier, total: sum + spec.modifier, hidden };
}

/** Parse + roll in one call. Returns null if the expression is malformed. */
export function roll(
  expr: string,
  mode: RollMode = 'normal',
  hidden = false,
  rng: () => number = Math.random
): RollResult | null {
  const spec = parseDice(expr);
  return spec ? rollDice(spec, mode, hidden, rng) : null;
}

export interface Macro {
  id: string;
  label: string;
  expr: string;
}

export const DEFAULT_MACROS: Macro[] = [
  { id: 'd20', label: 'd20', expr: '1d20' },
  { id: 'atk', label: 'Attack', expr: '1d20+5' },
  { id: 'fireball', label: 'Fireball', expr: '8d6' },
  { id: 'd100', label: 'd100', expr: '1d100' },
];
