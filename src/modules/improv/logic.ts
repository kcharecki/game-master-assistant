/** Injectable RNG: returns a float in [0, 1). Defaults to Math.random. */
export type Rng = () => number;

export type PromptKind = 'complication' | 'twist' | 'npc';

export interface ImprovPrompt {
  kind: PromptKind;
  text: string;
}

const COMPLICATIONS = [
  'A sudden storm cuts off the only road out.',
  'A trusted ally is revealed to be lying about something small but telling.',
  'The thing the party came for is already gone.',
  'A rival group arrives with the same goal.',
  'Someone the party wronged earlier shows up at the worst time.',
  'A piece of vital equipment fails right now.',
];

const TWISTS = [
  'The victim was the real villain all along.',
  'The map leads somewhere the players have already been.',
  'The patron has been dead for weeks — who hired them?',
  'The monster is protecting something innocent.',
  'The reward is cursed, and everyone in town knows but them.',
  'The two factions are secretly the same organisation.',
];

const NPCS = [
  'A nervous clerk who knows too much and wants out.',
  'A cheerful smuggler with a soft spot for strays.',
  'A retired soldier nursing one last grudge.',
  'A child who has seen the thing in the dark.',
  'A merchant who deals only in secrets.',
  'A zealot certain the party are the chosen ones.',
];

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

const KINDS: PromptKind[] = ['complication', 'twist', 'npc'];
const TABLES: Record<PromptKind, readonly string[]> = {
  complication: COMPLICATIONS,
  twist: TWISTS,
  npc: NPCS,
};

/**
 * Generate one improv prompt — a complication, twist, or NPC — for when the
 * players go off-rail. Two rng draws: one for the kind, one for the entry.
 * Deterministic for a given rng. Pure — no DOM, no store.
 */
export function improvPrompt(rng: Rng = Math.random): ImprovPrompt {
  const kind = pick(KINDS, rng);
  return { kind, text: pick(TABLES[kind], rng) };
}
