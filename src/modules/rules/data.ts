import type { GameSystem } from '../../lib/system';

/**
 * Rules & Rulings data model.
 *
 * Two linked datasets: canonical **reference** entries (`RuleEntry`) and the
 * GM's **rulings log** (`Ruling`). Reference bodies are original, concise
 * paraphrases of common tabletop mechanics — the *essence* of a rule, not any
 * publisher's wording. No copyrighted text is reproduced; `source` is a pointer
 * for the GM to look up the full text in their own book.
 */

export type RuleCategory =
  | 'combat'
  | 'conditions'
  | 'magic'
  | 'exploration'
  | 'social'
  | 'character'
  | 'sanity'
  | 'chase'
  | 'gear'
  | 'gm';

/** A single rules-reference entry. `system: 'both'` shows in either system. */
export interface RuleEntry {
  id: string;
  term: string;
  body: string;
  system: GameSystem | 'both';
  category: RuleCategory;
  /** Synonyms/alternate phrasings that should also match this entry in search. */
  aliases: string[];
  tags: string[];
  /** Where the GM can read the full official text — never the text itself. */
  source?: { book?: string; page?: string };
  /** Seed entry (true) vs GM-authored custom entry (false). */
  builtin: boolean;
  pinned?: boolean;
}

/**
 * A house rule or an on-the-fly decision the GM made at the table, logged so
 * they stay consistent later. Optionally clarifies a specific `RuleEntry`.
 */
export interface Ruling {
  id: string;
  title: string;
  body: string;
  system: GameSystem | 'both';
  /** The reference entry this ruling clarifies/overrides, if any. */
  ruleId?: string;
  tags: string[];
  /** ISO timestamp, stamped on creation. */
  createdAt: string;
  /** In-play context when logged, e.g. "Session 4" or "Round 12". */
  sessionLabel?: string;
  status: 'active' | 'retired';
}

/** Human labels for categories (i18n keys derive from the enum value). */
export const RULE_CATEGORIES: RuleCategory[] = [
  'combat',
  'conditions',
  'magic',
  'exploration',
  'social',
  'character',
  'sanity',
  'chase',
  'gear',
  'gm',
];

// Shorthand so the seed table below stays readable.
function r(
  id: string,
  term: string,
  category: RuleCategory,
  system: RuleEntry['system'],
  body: string,
  aliases: string[] = [],
  tags: string[] = [],
  source?: RuleEntry['source'],
): RuleEntry {
  return { id, term, body, system, category, aliases, tags, source, builtin: true };
}

/**
 * Seed reference set — original paraphrases covering the mechanics a GM reaches
 * for most during play. Bodies are deliberately short (a reminder, not a manual).
 */
export const rulesEntries: RuleEntry[] = [
  // ── D&D 5e · conditions ────────────────────────────────────────────────
  r('blinded', 'Blinded', 'conditions', 'dnd5e',
    "Can't see: auto-fails sight-based checks, attacks against it have advantage, its own attacks have disadvantage.",
    ['blind'], ['condition'], { book: 'PHB' }),
  r('charmed', 'Charmed', 'conditions', 'dnd5e',
    "Can't attack or target the charmer with harmful effects; the charmer has advantage on social checks with it.",
    [], ['condition']),
  r('frightened', 'Frightened', 'conditions', 'dnd5e',
    'Disadvantage on checks and attacks while the fear source is in sight, and it cannot willingly move closer to it.',
    ['fear', 'afraid'], ['condition']),
  r('grappled', 'Grappled', 'conditions', 'dnd5e',
    "Speed drops to 0 and gains no speed bonuses. Ends if the grappler is incapacitated or the two are forced apart.",
    ['grab', 'grapple'], ['condition']),
  r('incapacitated', 'Incapacitated', 'conditions', 'dnd5e',
    'Can take no actions or reactions.',
    [], ['condition']),
  r('invisible', 'Invisible', 'conditions', 'dnd5e',
    'Impossible to see without special senses; attacks against it have disadvantage, its attacks have advantage.',
    ['unseen', 'hidden'], ['condition']),
  r('paralyzed', 'Paralyzed', 'conditions', 'dnd5e',
    'Incapacitated, can\'t move or speak, auto-fails STR/DEX saves; attacks have advantage and any hit within 5 ft is a crit.',
    ['paralysis'], ['condition']),
  r('petrified', 'Petrified', 'conditions', 'dnd5e',
    'Turned to solid substance: incapacitated, unaware, resistant to all damage, immune to poison and disease progression.',
    ['stone', 'statue'], ['condition']),
  r('poisoned', 'Poisoned', 'conditions', 'dnd5e',
    'Disadvantage on attack rolls and ability checks.',
    ['poison'], ['condition']),
  r('prone', 'Prone', 'conditions', 'dnd5e',
    'Can only crawl until standing (costs half movement). Own attacks have disadvantage; melee attacks against it have advantage, ranged have disadvantage.',
    ['knocked down'], ['condition']),
  r('restrained', 'Restrained', 'conditions', 'dnd5e',
    'Speed 0; attacks against it have advantage, its attacks have disadvantage, and it has disadvantage on DEX saves.',
    ['bound', 'entangled'], ['condition']),
  r('stunned', 'Stunned', 'conditions', 'dnd5e',
    'Incapacitated, can\'t move, speaks haltingly, auto-fails STR/DEX saves; attacks against it have advantage.',
    ['stun'], ['condition']),
  r('unconscious', 'Unconscious', 'conditions', 'dnd5e',
    'Incapacitated, prone, drops what it holds, unaware; auto-fails STR/DEX saves, attacks have advantage, hits within 5 ft crit.',
    ['knocked out', 'ko'], ['condition']),
  r('exhaustion', 'Exhaustion', 'conditions', 'dnd5e',
    'Six worsening levels, from disadvantage on checks up to death at level 6. A long rest removes one level.',
    ['tired', 'fatigue'], ['condition', 'rest']),

  // ── D&D 5e · combat ────────────────────────────────────────────────────
  r('advantage', 'Advantage / Disadvantage', 'combat', 'dnd5e',
    'Roll two d20 and keep the higher (advantage) or lower (disadvantage). Multiple sources don\'t stack, and the two cancel out entirely.',
    ['adv', 'disadv'], ['roll', 'core']),
  r('actions', 'Actions in Combat', 'combat', 'dnd5e',
    'Each turn you get movement, one action, and possibly one bonus action; reactions happen off-turn. Common actions: Attack, Cast, Dash, Disengage, Dodge, Help, Hide, Ready, Search.',
    ['action economy', 'turn'], ['core']),
  r('opportunity', 'Opportunity Attack', 'combat', 'dnd5e',
    'When a hostile creature leaves your reach on foot, spend your reaction for one melee attack. Disengage avoids it.',
    ['aoo', 'attack of opportunity'], []),
  r('death-saves', 'Death Saving Throws', 'combat', 'dnd5e',
    'At 0 HP, each turn roll d20: 10+ succeeds, under 10 fails (a nat 1 counts twice). Three successes stabilize; three failures kill. A nat 20 revives at 1 HP.',
    ['dying', 'death save'], ['core']),
  r('concentration', 'Concentration', 'magic', 'dnd5e',
    'Holding a concentration spell breaks if you cast another, are incapacitated, or fail a CON save (DC 10 or half the damage taken, whichever is higher) after taking damage.',
    ['concentrate'], ['spell']),
  r('grapple-shove', 'Grapple & Shove', 'combat', 'dnd5e',
    'Replace one attack with a special melee attack: your Athletics vs the target\'s Athletics or Acrobatics to grab, or to push it 5 ft or knock it prone.',
    ['shove', 'push'], []),
  r('two-weapon', 'Two-Weapon Fighting', 'combat', 'dnd5e',
    'Attack with a light weapon in each hand: use a bonus action for the off-hand strike, which adds no ability modifier to damage unless a feature says so.',
    ['dual wield', 'off-hand'], []),
  r('cover', 'Cover', 'combat', 'both',
    'Half cover gives +2 AC and DEX saves, three-quarters gives +5, and total cover blocks line of effect entirely.',
    ['obscured'], ['core']),
  r('crit', 'Critical Hit', 'combat', 'dnd5e',
    'A natural 20 on an attack hits and lets you roll the attack\'s damage dice twice, adding modifiers once.',
    ['critical', 'nat 20'], []),
  r('surprise', 'Surprise', 'combat', 'both',
    "Compare the ambushers' stealth to the victims' passive perception. Surprised creatures act on nothing during their first turn and can't react until it ends.",
    ['ambush'], ['core']),

  // ── D&D 5e · exploration / character ──────────────────────────────────
  r('ability-check', 'Ability Check', 'character', 'dnd5e',
    'Roll d20 + ability modifier (+ proficiency if applicable) against a DC the GM sets. Contests pit two checks against each other.',
    ['skill check', 'check', 'dc'], ['core']),
  r('passive', 'Passive Checks', 'character', 'dnd5e',
    'A no-roll result equal to 10 + all modifiers, used for perception and secret checks. Advantage adds 5, disadvantage subtracts 5.',
    ['passive perception'], []),
  r('saving-throw', 'Saving Throw', 'character', 'dnd5e',
    'A reactive d20 + ability modifier (+ proficiency for your class\'s saves) against an effect\'s DC to resist or lessen it.',
    ['save', 'saving throws'], ['core']),
  r('resting', 'Short & Long Rest', 'character', 'dnd5e',
    'A short rest is ~1 hour and lets you spend Hit Dice to heal. A long rest is ~8 hours and restores all HP, half your Hit Dice, and most resources.',
    ['rest', 'long rest', 'short rest', 'heal'], ['rest']),
  r('falling', 'Falling', 'exploration', 'dnd5e',
    '1d6 bludgeoning per 10 feet fallen, capped at 20d6, and you land prone unless you avoid the damage somehow.',
    ['fall damage'], []),
  r('travel', 'Travel Pace', 'exploration', 'dnd5e',
    'Fast pace covers more ground but gives −5 passive perception; slow pace allows stealth. Normal sits between them.',
    ['overland', 'pace'], []),
  r('spell-slots', 'Spell Slots', 'magic', 'dnd5e',
    'Casting expends a slot of the spell\'s level or higher; higher slots often upcast the effect. Slots return on a long rest.',
    ['slots', 'upcast'], ['spell']),
  r('inspiration', 'Inspiration', 'character', 'dnd5e',
    'A held reward you can spend to gain advantage on one d20 roll. You either have it or you don\'t — it doesn\'t stack.',
    ['inspire'], []),

  // ── Call of Cthulhu 7e ────────────────────────────────────────────────
  r('skill-roll', 'Skill Roll & Difficulty', 'character', 'coc7e',
    'Roll d100 under your skill for a Regular success, under half for Hard, under a fifth for Extreme. The GM sets the required level by the task.',
    ['skill check', 'percentile', 'roll under'], ['core']),
  r('pushing', 'Pushing a Roll', 'character', 'coc7e',
    'After a failure, justify extra effort and re-roll once. A pushed failure lets the GM inflict a real, worse consequence.',
    ['push', 'reroll'], ['core']),
  r('bonus-dice', 'Bonus & Penalty Dice', 'character', 'coc7e',
    'Add an extra tens die and keep the better (bonus) or worse (penalty) result. They cancel one-for-one across sources.',
    ['bonus die', 'penalty die'], []),
  r('luck', 'Spending Luck', 'character', 'coc7e',
    'Spend Luck points one-for-one to raise a failed roll to a bare success. Luck is slow to recover, so it runs out.',
    ['luck points'], []),
  r('luck-recovery', 'Luck Recovery', 'character', 'coc7e',
    'Between sessions or scenarios, investigators roll to regain spent Luck; it seldom returns quickly, keeping pressure on.',
    ['recover luck'], []),
  r('opposed', 'Opposed Roll', 'character', 'coc7e',
    'When two characters directly contest, both roll their skill and the higher level of success wins; ties favor the defender or the higher skill.',
    ['contest', 'opposed'], []),
  r('sanity-loss', 'Sanity Loss', 'sanity', 'coc7e',
    'Facing horror calls for a Sanity roll: success costs the smaller loss, failure the larger (e.g. 1/1D6). SAN can\'t drop below 0.',
    ['san loss', 'san check', 'madness'], ['core']),
  r('temp-insanity', 'Temporary Insanity', 'sanity', 'coc7e',
    'Losing 5+ SAN at once triggers a bout of madness lasting minutes (real time) or a short scene, with a rolled or chosen episode.',
    ['bout of madness', 'temporary insanity'], []),
  r('indef-insanity', 'Indefinite Insanity', 'sanity', 'coc7e',
    'Losing a fifth of current SAN in a day brings longer-term madness that only heals through downtime and care.',
    ['indefinite insanity'], []),
  r('san-recovery', 'Sanity Recovery', 'sanity', 'coc7e',
    'Investigators regain SAN by resolving scenarios, self-help, or therapy — always slower than they lose it.',
    ['recover san', 'heal sanity'], []),
  r('coc-combat', 'Fighting & Firearms', 'combat', 'coc7e',
    'Attacks are skill rolls; a defender may Dodge or Fight Back as an opposed roll. Firearms outside melee are usually unopposed.',
    ['attack', 'fight back', 'dodge'], []),
  r('malfunction', 'Firearm Malfunction', 'combat', 'coc7e',
    'Each firearm has a malfunction number; rolling it or higher jams or breaks the weapon instead of firing cleanly.',
    ['jam', 'misfire'], ['gear']),
  r('major-wound', 'Major Wound', 'combat', 'coc7e',
    'Taking damage equal to half max HP or more in one hit is a major wound: roll CON to stay conscious and risk lasting injury.',
    ['serious wound', 'wound'], []),
  r('damage-bonus', 'Damage Bonus & Build', 'combat', 'coc7e',
    'Size and strength give a Damage Bonus (or penalty) added to melee damage, and a Build value that matters in grapples and chases.',
    ['db', 'build'], []),
  r('first-aid', 'First Aid & Healing', 'character', 'coc7e',
    'First Aid restores a little HP once per wound; Medicine heals more slowly over days. First aid can save a dying investigator.',
    ['heal', 'medicine'], []),
  r('chase', 'Chases', 'chase', 'coc7e',
    'Chases run on movement actions and hazards rather than fixed distance: participants spend actions to clear obstacles and close or open the gap.',
    ['pursuit', 'running'], []),
  r('credit-rating', 'Credit Rating', 'social', 'coc7e',
    'A skill standing in for wealth and lifestyle; it gates what an investigator can afford and how society treats them.',
    ['wealth', 'money', 'cr'], []),
];
