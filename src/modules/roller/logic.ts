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

/**
 * Player-safe card model for a public roll: exactly the fields sent to the
 * broadcast. Never carries `hidden` (hidden rolls stay GM-only and are never
 * turned into a card). `outcome` holds the CoC d100 success tier when relevant.
 */
export interface RollCard {
  label?: string;
  expr: string;
  rolls: number[];
  kept: number[];
  modifier: number;
  total: number;
  outcome?: string;
}

/**
 * Build the player-safe card model from a RollResult. Strips `hidden`. For a
 * single-die d100 roll, attaches the CoC success tier text as `outcome`.
 */
export function rollCardModel(result: RollResult, expr: string, label?: string): RollCard {
  const spec = parseDice(expr);
  const card: RollCard = {
    ...(label ? { label } : {}),
    expr,
    // Copy to plain arrays: the caller's RollResult may be a reactive ($state)
    // proxy, which can't be structured-cloned across the BroadcastChannel.
    rolls: [...result.rolls],
    kept: [...result.kept],
    modifier: result.modifier,
    total: result.total,
  };
  if (spec && spec.count === 1 && spec.sides === 100 && result.kept.length === 1) {
    card.outcome = rollOutcome(result.kept[0]);
  }
  return card;
}

/** One entry in the roller history log. Kept GM-side; may be re-aired if public. */
export interface HistoryEntry {
  id: string;
  expr: string;
  label?: string;
  result: RollResult;
  at: number;
}

/** Prepend `entry` and trim history to the newest `max` entries. Pure. */
export function trimHistory(history: HistoryEntry[], entry: HistoryEntry, max = 20): HistoryEntry[] {
  return [entry, ...history].slice(0, max);
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
