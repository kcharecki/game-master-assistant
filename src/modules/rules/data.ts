import type { GameSystem } from '../../lib/system';
import type { LocalizedText } from '../../lib/loc';

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
  term: LocalizedText;
  body: LocalizedText;
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
  title: LocalizedText;
  body: LocalizedText;
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
  term: LocalizedText,
  category: RuleCategory,
  system: RuleEntry['system'],
  body: LocalizedText,
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
  r('blinded', { en: 'Blinded', pl: 'Oślepiony' }, 'conditions', 'dnd5e',
    { en: "Can't see: auto-fails sight-based checks, attacks against it have advantage, its own attacks have disadvantage.",
      pl: 'Nie widzi: automatycznie oblewa testy oparte na wzroku, ataki przeciw niemu mają Przewagę, a jego własne ataki Utrudnienie.' },
    ['blind'], ['condition'], { book: 'PHB' }),
  r('charmed', { en: 'Charmed', pl: 'Oczarowany' }, 'conditions', 'dnd5e',
    { en: "Can't attack or target the charmer with harmful effects; the charmer has advantage on social checks with it.",
      pl: 'Nie może atakować ani obierać czarującego za cel szkodliwych efektów; czarujący ma Przewagę na testy społeczne wobec niego.' },
    [], ['condition']),
  r('frightened', { en: 'Frightened', pl: 'Przerażony' }, 'conditions', 'dnd5e',
    { en: 'Disadvantage on checks and attacks while the fear source is in sight, and it cannot willingly move closer to it.',
      pl: 'Utrudnienie na testy i ataki, gdy źródło strachu jest w polu widzenia; nie może też dobrowolnie się do niego zbliżać.' },
    ['fear', 'afraid'], ['condition']),
  r('grappled', { en: 'Grappled', pl: 'Schwytany' }, 'conditions', 'dnd5e',
    { en: "Speed drops to 0 and gains no speed bonuses. Ends if the grappler is incapacitated or the two are forced apart.",
      pl: 'Szybkość spada do 0 i nie zyskuje premii do niej. Kończy się, gdy chwytający zostanie obezwładniony lub gdy zostaną rozdzieleni.' },
    ['grab', 'grapple'], ['condition']),
  r('incapacitated', { en: 'Incapacitated', pl: 'Obezwładniony' }, 'conditions', 'dnd5e',
    { en: 'Can take no actions or reactions.',
      pl: 'Nie może wykonywać akcji ani reakcji.' },
    [], ['condition']),
  r('invisible', { en: 'Invisible', pl: 'Niewidzialny' }, 'conditions', 'dnd5e',
    { en: 'Impossible to see without special senses; attacks against it have disadvantage, its attacks have advantage.',
      pl: 'Niewidoczny bez specjalnych zmysłów; ataki przeciw niemu mają Utrudnienie, a jego ataki Przewagę.' },
    ['unseen', 'hidden'], ['condition']),
  r('paralyzed', { en: 'Paralyzed', pl: 'Sparaliżowany' }, 'conditions', 'dnd5e',
    { en: 'Incapacitated, can\'t move or speak, auto-fails STR/DEX saves; attacks have advantage and any hit within 5 ft is a crit.',
      pl: 'Obezwładniony, nie może się ruszać ani mówić, automatycznie oblewa rzuty obronne SIŁ/ZRĘ; ataki mają Przewagę, a trafienie z odległości do 5 stóp jest krytyczne.' },
    ['paralysis'], ['condition']),
  r('petrified', { en: 'Petrified', pl: 'Skamieniały' }, 'conditions', 'dnd5e',
    { en: 'Turned to solid substance: incapacitated, unaware, resistant to all damage, immune to poison and disease progression.',
      pl: 'Zamieniony w stałą materię: obezwładniony, nieświadomy, odporny na wszelkie obrażenia oraz na truciznę i postęp chorób.' },
    ['stone', 'statue'], ['condition']),
  r('poisoned', { en: 'Poisoned', pl: 'Zatruty' }, 'conditions', 'dnd5e',
    { en: 'Disadvantage on attack rolls and ability checks.',
      pl: 'Utrudnienie na rzuty ataku i testy cech.' },
    ['poison'], ['condition']),
  r('prone', { en: 'Prone', pl: 'Powalony' }, 'conditions', 'dnd5e',
    { en: 'Can only crawl until standing (costs half movement). Own attacks have disadvantage; melee attacks against it have advantage, ranged have disadvantage.',
      pl: 'Może tylko czołgać się do momentu wstania (kosztuje połowę ruchu). Własne ataki mają Utrudnienie; ataki wręcz przeciw niemu mają Przewagę, a dystansowe Utrudnienie.' },
    ['knocked down'], ['condition']),
  r('restrained', { en: 'Restrained', pl: 'Unieruchomiony' }, 'conditions', 'dnd5e',
    { en: 'Speed 0; attacks against it have advantage, its attacks have disadvantage, and it has disadvantage on DEX saves.',
      pl: 'Szybkość 0; ataki przeciw niemu mają Przewagę, jego ataki Utrudnienie, a on sam ma Utrudnienie na rzuty obronne ZRĘ.' },
    ['bound', 'entangled'], ['condition']),
  r('stunned', { en: 'Stunned', pl: 'Ogłuszony' }, 'conditions', 'dnd5e',
    { en: 'Incapacitated, can\'t move, speaks haltingly, auto-fails STR/DEX saves; attacks against it have advantage.',
      pl: 'Obezwładniony, nie może się ruszać, mówi z trudem, automatycznie oblewa rzuty obronne SIŁ/ZRĘ; ataki przeciw niemu mają Przewagę.' },
    ['stun'], ['condition']),
  r('unconscious', { en: 'Unconscious', pl: 'Nieprzytomny' }, 'conditions', 'dnd5e',
    { en: 'Incapacitated, prone, drops what it holds, unaware; auto-fails STR/DEX saves, attacks have advantage, hits within 5 ft crit.',
      pl: 'Obezwładniony, powalony, upuszcza trzymane przedmioty, nieświadomy; automatycznie oblewa rzuty obronne SIŁ/ZRĘ, ataki mają Przewagę, a trafienia z odległości do 5 stóp są krytyczne.' },
    ['knocked out', 'ko'], ['condition']),
  r('exhaustion', { en: 'Exhaustion', pl: 'Wyczerpanie' }, 'conditions', 'dnd5e',
    { en: 'Six worsening levels, from disadvantage on checks up to death at level 6. A long rest removes one level.',
      pl: 'Sześć nasilających się poziomów, od Utrudnienia na testy aż po śmierć na poziomie 6. Długi odpoczynek usuwa jeden poziom.' },
    ['tired', 'fatigue'], ['condition', 'rest']),

  // ── D&D 5e · combat ────────────────────────────────────────────────────
  r('advantage', { en: 'Advantage / Disadvantage', pl: 'Przewaga / Utrudnienie' }, 'combat', 'dnd5e',
    { en: 'Roll two d20 and keep the higher (advantage) or lower (disadvantage). Multiple sources don\'t stack, and the two cancel out entirely.',
      pl: 'Rzuć dwiema k20 i zachowaj wyższą (Przewaga) lub niższą (Utrudnienie). Wiele źródeł nie kumuluje się, a Przewaga i Utrudnienie znoszą się całkowicie.' },
    ['adv', 'disadv'], ['roll', 'core']),
  r('actions', { en: 'Actions in Combat', pl: 'Akcje w walce' }, 'combat', 'dnd5e',
    { en: 'Each turn you get movement, one action, and possibly one bonus action; reactions happen off-turn. Common actions: Attack, Cast, Dash, Disengage, Dodge, Help, Hide, Ready, Search.',
      pl: 'W każdej turze masz ruch, jedną akcję i ewentualnie jedną akcję dodatkową; reakcje zachodzą poza turą. Typowe akcje: Atak, Rzucenie czaru, Bieg, Odwrót, Unik, Pomoc, Ukrycie, Przygotowanie, Przeszukanie.' },
    ['action economy', 'turn'], ['core']),
  r('opportunity', { en: 'Opportunity Attack', pl: 'Atak okazyjny' }, 'combat', 'dnd5e',
    { en: 'When a hostile creature leaves your reach on foot, spend your reaction for one melee attack. Disengage avoids it.',
      pl: 'Gdy wroga istota pieszo opuszcza twój zasięg, wykorzystaj reakcję na jeden atak wręcz. Akcja Odwrotu tego unika.' },
    ['aoo', 'attack of opportunity'], []),
  r('death-saves', { en: 'Death Saving Throws', pl: 'Rzuty obronne przed śmiercią' }, 'combat', 'dnd5e',
    { en: 'At 0 HP, each turn roll d20: 10+ succeeds, under 10 fails (a nat 1 counts twice). Three successes stabilize; three failures kill. A nat 20 revives at 1 HP.',
      pl: 'Przy 0 PW co turę rzuć k20: 10+ to sukces, poniżej 10 porażka (naturalna 1 liczy się podwójnie). Trzy sukcesy stabilizują, trzy porażki zabijają. Naturalne 20 przywraca 1 PW.' },
    ['dying', 'death save'], ['core']),
  r('concentration', { en: 'Concentration', pl: 'Koncentracja' }, 'magic', 'dnd5e',
    { en: 'Holding a concentration spell breaks if you cast another, are incapacitated, or fail a CON save (DC 10 or half the damage taken, whichever is higher) after taking damage.',
      pl: 'Utrzymywanie czaru z koncentracją pryska, gdy rzucisz kolejny taki czar, zostaniesz obezwładniony lub po otrzymaniu obrażeń oblejesz rzut obronny KON (ST 10 albo połowa obrażeń, zależnie co wyższe).' },
    ['concentrate'], ['spell']),
  r('grapple-shove', { en: 'Grapple & Shove', pl: 'Chwyt i pchnięcie' }, 'combat', 'dnd5e',
    { en: 'Replace one attack with a special melee attack: your Athletics vs the target\'s Athletics or Acrobatics to grab, or to push it 5 ft or knock it prone.',
      pl: 'Zamień jeden atak na specjalny atak wręcz: twoja Atletyka przeciw Atletyce lub Akrobatyce celu, by go schwytać, odepchnąć o 5 stóp lub powalić.' },
    ['shove', 'push'], []),
  r('two-weapon', { en: 'Two-Weapon Fighting', pl: 'Walka dwiema broniami' }, 'combat', 'dnd5e',
    { en: 'Attack with a light weapon in each hand: use a bonus action for the off-hand strike, which adds no ability modifier to damage unless a feature says so.',
      pl: 'Atakuj lekką bronią w każdej ręce: cios ręką pomocniczą wykonaj akcją dodatkową; nie dodaje on modyfikatora cechy do obrażeń, chyba że jakaś zdolność mówi inaczej.' },
    ['dual wield', 'off-hand'], []),
  r('cover', { en: 'Cover', pl: 'Osłona' }, 'combat', 'both',
    { en: 'Half cover gives +2 AC and DEX saves, three-quarters gives +5, and total cover blocks line of effect entirely.',
      pl: 'Częściowa osłona daje +2 do AC i rzutów obronnych ZRĘ, trzyćwierciowa +5, a pełna osłona całkowicie blokuje linię efektu.' },
    ['obscured'], ['core']),
  r('crit', { en: 'Critical Hit', pl: 'Trafienie krytyczne' }, 'combat', 'dnd5e',
    { en: 'A natural 20 on an attack hits and lets you roll the attack\'s damage dice twice, adding modifiers once.',
      pl: 'Naturalne 20 przy ataku trafia i pozwala rzucić kośćmi obrażeń ataku dwukrotnie, dodając modyfikatory tylko raz.' },
    ['critical', 'nat 20'], []),
  r('surprise', { en: 'Surprise', pl: 'Zaskoczenie' }, 'combat', 'both',
    { en: "Compare the ambushers' stealth to the victims' passive perception. Surprised creatures act on nothing during their first turn and can't react until it ends.",
      pl: 'Porównaj skradanie zasadzki z pasywną percepcją ofiar. Zaskoczone istoty nie robią nic w swojej pierwszej turze i nie mogą reagować, dopóki się ona nie skończy.' },
    ['ambush'], ['core']),

  // ── D&D 5e · exploration / character ──────────────────────────────────
  r('ability-check', { en: 'Ability Check', pl: 'Test cechy' }, 'character', 'dnd5e',
    { en: 'Roll d20 + ability modifier (+ proficiency if applicable) against a DC the GM sets. Contests pit two checks against each other.',
      pl: 'Rzuć k20 + modyfikator cechy (+ biegłość, jeśli dotyczy) przeciw ST ustalonemu przez MG. W rywalizacji dwa testy zestawia się ze sobą.' },
    ['skill check', 'check', 'dc'], ['core']),
  r('passive', { en: 'Passive Checks', pl: 'Testy pasywne' }, 'character', 'dnd5e',
    { en: 'A no-roll result equal to 10 + all modifiers, used for perception and secret checks. Advantage adds 5, disadvantage subtracts 5.',
      pl: 'Wynik bez rzutu równy 10 + wszystkie modyfikatory, używany do percepcji i ukrytych testów. Przewaga dodaje 5, Utrudnienie odejmuje 5.' },
    ['passive perception'], []),
  r('saving-throw', { en: 'Saving Throw', pl: 'Rzut obronny' }, 'character', 'dnd5e',
    { en: 'A reactive d20 + ability modifier (+ proficiency for your class\'s saves) against an effect\'s DC to resist or lessen it.',
      pl: 'Reaktywny rzut k20 + modyfikator cechy (+ biegłość dla rzutów twojej klasy) przeciw ST efektu, by mu się oprzeć lub go osłabić.' },
    ['save', 'saving throws'], ['core']),
  r('resting', { en: 'Short & Long Rest', pl: 'Krótki i długi odpoczynek' }, 'character', 'dnd5e',
    { en: 'A short rest is ~1 hour and lets you spend Hit Dice to heal. A long rest is ~8 hours and restores all HP, half your Hit Dice, and most resources.',
      pl: 'Krótki odpoczynek trwa ok. 1 godziny i pozwala wydać Kości Wytrzymałości na leczenie. Długi odpoczynek trwa ok. 8 godzin i przywraca wszystkie PW, połowę Kości Wytrzymałości i większość zasobów.' },
    ['rest', 'long rest', 'short rest', 'heal'], ['rest']),
  r('falling', { en: 'Falling', pl: 'Upadek' }, 'exploration', 'dnd5e',
    { en: '1d6 bludgeoning per 10 feet fallen, capped at 20d6, and you land prone unless you avoid the damage somehow.',
      pl: '1k6 obrażeń obuchowych za każde 10 stóp upadku, maksymalnie 20k6, i lądujesz powalony, o ile jakoś nie unikniesz obrażeń.' },
    ['fall damage'], []),
  r('travel', { en: 'Travel Pace', pl: 'Tempo podróży' }, 'exploration', 'dnd5e',
    { en: 'Fast pace covers more ground but gives −5 passive perception; slow pace allows stealth. Normal sits between them.',
      pl: 'Szybkie tempo pokonuje więcej dystansu, ale daje −5 do pasywnej percepcji; wolne tempo pozwala się skradać. Normalne leży pomiędzy nimi.' },
    ['overland', 'pace'], []),
  r('spell-slots', { en: 'Spell Slots', pl: 'Komórki czarów' }, 'magic', 'dnd5e',
    { en: 'Casting expends a slot of the spell\'s level or higher; higher slots often upcast the effect. Slots return on a long rest.',
      pl: 'Rzucenie czaru zużywa komórkę jego poziomu lub wyższą; wyższe komórki często wzmacniają efekt. Komórki wracają po długim odpoczynku.' },
    ['slots', 'upcast'], ['spell']),
  r('inspiration', { en: 'Inspiration', pl: 'Inspiracja' }, 'character', 'dnd5e',
    { en: 'A held reward you can spend to gain advantage on one d20 roll. You either have it or you don\'t — it doesn\'t stack.',
      pl: 'Zachowana nagroda, którą można wydać, by zyskać Przewagę na jeden rzut k20. Albo ją masz, albo nie — nie kumuluje się.' },
    ['inspire'], []),

  // ── Call of Cthulhu 7e ────────────────────────────────────────────────
  r('skill-roll', { en: 'Skill Roll & Difficulty', pl: 'Test umiejętności i poziom trudności' }, 'character', 'coc7e',
    { en: 'Roll d100 under your skill for a Regular success, under half for Hard, under a fifth for Extreme. The GM sets the required level by the task.',
      pl: 'Rzuć k100 poniżej wartości umiejętności dla zwykłego sukcesu, poniżej połowy dla trudnego, poniżej jednej piątej dla ekstremalnego. MG ustala wymagany poziom według zadania.' },
    ['skill check', 'percentile', 'roll under'], ['core']),
  r('pushing', { en: 'Pushing a Roll', pl: 'Naciskanie testu' }, 'character', 'coc7e',
    { en: 'After a failure, justify extra effort and re-roll once. A pushed failure lets the GM inflict a real, worse consequence.',
      pl: 'Po porażce uzasadnij dodatkowy wysiłek i przerzuć raz. Nieudany naciskany test pozwala MG nałożyć realną, gorszą konsekwencję.' },
    ['push', 'reroll'], ['core']),
  r('bonus-dice', { en: 'Bonus & Penalty Dice', pl: 'Kości premiowe i karne' }, 'character', 'coc7e',
    { en: 'Add an extra tens die and keep the better (bonus) or worse (penalty) result. They cancel one-for-one across sources.',
      pl: 'Dorzuć dodatkową kość dziesiątek i zachowaj lepszy (premiowa) lub gorszy (karna) wynik. Znoszą się jeden za jeden między źródłami.' },
    ['bonus die', 'penalty die'], []),
  r('luck', { en: 'Spending Luck', pl: 'Wydawanie Szczęścia' }, 'character', 'coc7e',
    { en: 'Spend Luck points one-for-one to raise a failed roll to a bare success. Luck is slow to recover, so it runs out.',
      pl: 'Wydaj punkty Szczęścia jeden za jeden, by podnieść nieudany test do ledwie sukcesu. Szczęście wolno się odnawia, więc się kończy.' },
    ['luck points'], []),
  r('luck-recovery', { en: 'Luck Recovery', pl: 'Odnawianie Szczęścia' }, 'character', 'coc7e',
    { en: 'Between sessions or scenarios, investigators roll to regain spent Luck; it seldom returns quickly, keeping pressure on.',
      pl: 'Między sesjami lub scenariuszami badacze rzucają, by odzyskać wydane Szczęście; rzadko wraca szybko, utrzymując napięcie.' },
    ['recover luck'], []),
  r('opposed', { en: 'Opposed Roll', pl: 'Test przeciwstawny' }, 'character', 'coc7e',
    { en: 'When two characters directly contest, both roll their skill and the higher level of success wins; ties favor the defender or the higher skill.',
      pl: 'Gdy dwie postacie bezpośrednio rywalizują, obie rzucają na swoją umiejętność i wygrywa wyższy poziom sukcesu; remis sprzyja broniącemu się lub wyższej umiejętności.' },
    ['contest', 'opposed'], []),
  r('sanity-loss', { en: 'Sanity Loss', pl: 'Utrata Poczytalności' }, 'sanity', 'coc7e',
    { en: 'Facing horror calls for a Sanity roll: success costs the smaller loss, failure the larger (e.g. 1/1D6). SAN can\'t drop below 0.',
      pl: 'Zetknięcie z grozą wymaga testu Poczytalności: sukces kosztuje mniejszą stratę, porażka większą (np. 1/1K6). SAN nie może spaść poniżej 0.' },
    ['san loss', 'san check', 'madness'], ['core']),
  r('temp-insanity', { en: 'Temporary Insanity', pl: 'Chwilowe szaleństwo' }, 'sanity', 'coc7e',
    { en: 'Losing 5+ SAN at once triggers a bout of madness lasting minutes (real time) or a short scene, with a rolled or chosen episode.',
      pl: 'Utrata 5+ SAN naraz wywołuje napad szaleństwa trwający minuty (czasu rzeczywistego) lub krótką scenę, z wylosowanym lub wybranym epizodem.' },
    ['bout of madness', 'temporary insanity'], []),
  r('indef-insanity', { en: 'Indefinite Insanity', pl: 'Przewlekłe szaleństwo' }, 'sanity', 'coc7e',
    { en: 'Losing a fifth of current SAN in a day brings longer-term madness that only heals through downtime and care.',
      pl: 'Utrata jednej piątej obecnego SAN w ciągu dnia sprowadza dłuższe szaleństwo, które leczy się tylko przez czas wolny i opiekę.' },
    ['indefinite insanity'], []),
  r('san-recovery', { en: 'Sanity Recovery', pl: 'Odzyskiwanie Poczytalności' }, 'sanity', 'coc7e',
    { en: 'Investigators regain SAN by resolving scenarios, self-help, or therapy — always slower than they lose it.',
      pl: 'Badacze odzyskują SAN, kończąc scenariusze, dzięki samopomocy lub terapii — zawsze wolniej, niż go tracą.' },
    ['recover san', 'heal sanity'], []),
  r('coc-combat', { en: 'Fighting & Firearms', pl: 'Walka i broń palna' }, 'combat', 'coc7e',
    { en: 'Attacks are skill rolls; a defender may Dodge or Fight Back as an opposed roll. Firearms outside melee are usually unopposed.',
      pl: 'Ataki to testy umiejętności; broniący się może Uniknąć lub Odeprzeć atak jako test przeciwstawny. Broń palna poza zwarciem zwykle nie jest przeciwstawiana.' },
    ['attack', 'fight back', 'dodge'], []),
  r('malfunction', { en: 'Firearm Malfunction', pl: 'Zacięcie broni palnej' }, 'combat', 'coc7e',
    { en: 'Each firearm has a malfunction number; rolling it or higher jams or breaks the weapon instead of firing cleanly.',
      pl: 'Każda broń palna ma wartość zacięcia; wyrzucenie jej lub wyższej zacina lub psuje broń, zamiast czystego wystrzału.' },
    ['jam', 'misfire'], ['gear']),
  r('major-wound', { en: 'Major Wound', pl: 'Poważna rana' }, 'combat', 'coc7e',
    { en: 'Taking damage equal to half max HP or more in one hit is a major wound: roll CON to stay conscious and risk lasting injury.',
      pl: 'Otrzymanie w jednym trafieniu obrażeń równych połowie maks. PW lub więcej to poważna rana: rzuć na KON, by pozostać przytomnym, i ryzykujesz trwały uraz.' },
    ['serious wound', 'wound'], []),
  r('damage-bonus', { en: 'Damage Bonus & Build', pl: 'Premia do obrażeń i Postura' }, 'combat', 'coc7e',
    { en: 'Size and strength give a Damage Bonus (or penalty) added to melee damage, and a Build value that matters in grapples and chases.',
      pl: 'Rozmiar i siła dają Premię do obrażeń (lub karę) doliczaną do obrażeń wręcz oraz wartość Postury, istotną w zwarciach i pościgach.' },
    ['db', 'build'], []),
  r('first-aid', { en: 'First Aid & Healing', pl: 'Pierwsza pomoc i leczenie' }, 'character', 'coc7e',
    { en: 'First Aid restores a little HP once per wound; Medicine heals more slowly over days. First aid can save a dying investigator.',
      pl: 'Pierwsza pomoc przywraca trochę PW raz na ranę; Medycyna leczy wolniej, przez dni. Pierwsza pomoc może uratować umierającego badacza.' },
    ['heal', 'medicine'], []),
  r('chase', { en: 'Chases', pl: 'Pościgi' }, 'chase', 'coc7e',
    { en: 'Chases run on movement actions and hazards rather than fixed distance: participants spend actions to clear obstacles and close or open the gap.',
      pl: 'Pościgi opierają się na akcjach ruchu i przeszkodach, a nie na stałym dystansie: uczestnicy wydają akcje, by pokonywać przeszkody i zmniejszać lub zwiększać odstęp.' },
    ['pursuit', 'running'], []),
  r('credit-rating', { en: 'Credit Rating', pl: 'Zamożność' }, 'social', 'coc7e',
    { en: 'A skill standing in for wealth and lifestyle; it gates what an investigator can afford and how society treats them.',
      pl: 'Umiejętność reprezentująca majątek i styl życia; wyznacza, na co badacza stać i jak traktuje go społeczeństwo.' },
    ['wealth', 'money', 'cr'], []),
];
