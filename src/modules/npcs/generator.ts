/** A random NPC seed: flavour for "that random guard" the players just talked to. */
export interface GeneratedNpc {
  name: string;
  trait: string;
  motivation: string;
  mannerism: string;
}

/** Injectable RNG: returns a float in [0, 1). Defaults to Math.random. */
export type Rng = () => number;

const NAMES = [
  'Bram Calloway',
  'Ysolde Finch',
  'Garrett Vane',
  'Nessa Dunmore',
  'Obed Marsh',
  'Tamsin Reed',
  'Cormac Sild',
  'Linnea Roche',
  'Hollis Pike',
  'Effie Wren',
];

const TRAITS = [
  'twitchy and overcaffeinated',
  'unflappably calm',
  'painfully honest',
  'secretly terrified',
  'gruff but kind',
  'smugly superior',
  'distracted, half-listening',
  'eager to please',
];

const MOTIVATIONS = [
  'wants to pay off a gambling debt',
  'is protecting a younger sibling',
  'seeks revenge against a former employer',
  'just wants to go home',
  'is hiding from the law',
  'dreams of leaving this town',
  'owes a favour to the wrong people',
  'is looking for a lost relative',
];

const MANNERISMS = [
  'cracks knuckles before speaking',
  'avoids eye contact',
  'overuses the word "honestly"',
  'fidgets with a coin',
  'laughs at the wrong moments',
  'speaks in a near-whisper',
  'always glancing over a shoulder',
  'finishes others’ sentences',
];

function pick<T>(arr: readonly T[], rng: Rng): T {
  const i = Math.floor(rng() * arr.length) % arr.length;
  return arr[i];
}

/**
 * Generate a random NPC from the seed tables. Deterministic for a given rng,
 * so tests inject a fixed sequence. Pure — no DOM, no store.
 */
export function generateNpc(rng: Rng = Math.random): GeneratedNpc {
  return {
    name: pick(NAMES, rng),
    trait: pick(TRAITS, rng),
    motivation: pick(MOTIVATIONS, rng),
    mannerism: pick(MANNERISMS, rng),
  };
}
