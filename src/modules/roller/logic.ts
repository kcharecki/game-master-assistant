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
