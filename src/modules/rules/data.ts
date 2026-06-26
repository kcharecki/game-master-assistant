import type { GameSystem } from '../../lib/system';

/** A single rules-reference entry. `system: 'both'` shows in either system. */
export interface RuleEntry {
  id: string;
  term: string;
  body: string;
  system: GameSystem | 'both';
}

/** A small seed SRD/system rules set — a handful of D&D + CoC entries. */
export const rulesEntries: RuleEntry[] = [
  {
    id: 'advantage',
    term: 'Advantage / Disadvantage',
    body: 'Roll 2d20 and take the higher (advantage) or lower (disadvantage). They cancel out and never stack.',
    system: 'dnd5e',
  },
  {
    id: 'grappled',
    term: 'Grappled',
    body: "Speed becomes 0 and can't benefit from bonuses to speed. Ends if the grappler is incapacitated.",
    system: 'dnd5e',
  },
  {
    id: 'death-saves',
    term: 'Death Saving Throws',
    body: 'At 0 HP, roll d20 each turn: 10+ is a success, under 10 a failure. Three successes stabilize; three failures = death.',
    system: 'dnd5e',
  },
  {
    id: 'opportunity',
    term: 'Opportunity Attack',
    body: 'When a creature leaves your reach, use your reaction to make one melee attack against it.',
    system: 'dnd5e',
  },
  {
    id: 'san-loss',
    term: 'Sanity Loss',
    body: 'On encountering horror, roll a Sanity check. Failure costs the larger SAN amount; a roll over current SAN can trigger temporary insanity.',
    system: 'coc7e',
  },
  {
    id: 'pushing',
    term: 'Pushing a Roll',
    body: 'After a failed skill roll, describe extra effort and re-roll once. Failing a pushed roll invites worse consequences.',
    system: 'coc7e',
  },
  {
    id: 'bonus-dice',
    term: 'Bonus & Penalty Dice',
    body: 'Roll an extra tens d10 and keep the better (bonus) or worse (penalty) result. They cancel one-for-one.',
    system: 'coc7e',
  },
  {
    id: 'luck',
    term: 'Spending Luck',
    body: 'Spend Luck points to nudge a failed roll up to a success. Luck is hard to recover, so spend it sparingly.',
    system: 'coc7e',
  },
  {
    id: 'surprise',
    term: 'Surprise',
    body: 'A surprised combatant takes no action or reaction on its first turn. Determined by perception vs. stealth.',
    system: 'both',
  },
  {
    id: 'cover',
    term: 'Cover',
    body: 'Partial cover hinders ranged attacks; full cover blocks line of sight and direct attacks entirely.',
    system: 'both',
  },
];
