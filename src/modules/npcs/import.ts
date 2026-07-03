import type { Disposition } from './store.svelte';
import type { LocalizedText } from '../../lib/loc';

// Import shapes carry NO ids — the store mints them. LLMs (or the GM) produce
// these from a photo of a stat block; see the *_PROMPT strings below. Every text
// value is localized ({ en, pl }); a plain string is accepted as a fallback.
export interface SpellImport {
  name: LocalizedText;
  cost?: LocalizedText;
  castingTime?: LocalizedText;
  altNames?: LocalizedText;
  description?: LocalizedText;
}

export interface NpcImport {
  name: LocalizedText;
  role?: LocalizedText;
  disposition?: Disposition;
  voice?: LocalizedText;
  publicBlurb?: LocalizedText;
  gmNotes?: LocalizedText;
  stats?: { key: LocalizedText; val: LocalizedText }[];
  attacks?: { name: LocalizedText; chance?: LocalizedText; damage?: LocalizedText }[];
  skills?: { name: LocalizedText; value?: LocalizedText }[];
  armor?: LocalizedText;
  sanityLoss?: LocalizedText;
  spells?: SpellImport[];
}

const DISPOSITIONS: Disposition[] = ['ally', 'neutral', 'hostile'];

// Every text value is a bilingual object { "en": ..., "pl": ... } so the app can
// switch between English and Polish. The word LOC below marks such fields.
const BILINGUAL_RULES = `Every text value must be a bilingual object of the form { "en": "English text", "pl": "Polski tekst" } — always give BOTH an English and a Polish version, translating faithfully. For values that are identical in both languages (numbers, dice, percentages like "1d6+DB" or "70%"), repeat the same string in "en" and "pl". In long prose fields (publicBlurb, gmNotes, description) preserve the source paragraph breaks by separating paragraphs with a "\\n" escape inside the string. Omit any field you cannot read — do not invent data. Return ONLY valid JSON, no markdown, no commentary.`;

/** The LLM prompt a GM copies, then pastes alongside a photo of a stat block. */
export const NPC_PROMPT = `You are given a photo of a tabletop RPG NPC or monster stat block (e.g. Call of Cthulhu 7e or D&D 5e), possibly in another language. Extract everything and output JSON matching this schema (LOC = a { "en", "pl" } bilingual object):

{
  "name": LOC,
  "role": LOC,
  "disposition": "ally | neutral | hostile",
  "voice": LOC,
  "publicBlurb": LOC,
  "gmNotes": LOC,
  "stats": [ { "key": LOC, "val": LOC } ],
  "attacks": [ { "name": LOC, "chance": LOC, "damage": LOC } ],
  "skills": [ { "name": LOC, "value": LOC } ],
  "armor": LOC,
  "sanityLoss": LOC,
  "spells": [ { "name": LOC, "cost": LOC, "castingTime": LOC, "altNames": LOC, "description": LOC } ]
}

${BILINGUAL_RULES} "disposition" is a plain string, not bilingual. For several creatures, output a JSON array of such objects.`;

/** The LLM prompt for spells only. */
export const SPELL_PROMPT = `You are given a photo of one or more tabletop RPG spells (e.g. Call of Cthulhu 7e), possibly in another language. Extract them and output JSON matching this schema (LOC = a { "en", "pl" } bilingual object):

{
  "name": LOC,
  "cost": LOC,
  "castingTime": LOC,
  "altNames": LOC,
  "description": LOC
}

${BILINGUAL_RULES} For several spells, output a JSON array of such objects.`;

/** Parse a JSON string that may be a single object or an array of objects. */
function parseArray(raw: string): { items: unknown[]; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], error: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { items: [], error: 'invalid-json' };
  }
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return { items: [], error: 'empty' };
  return { items };
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

/**
 * Coerce a value into LocalizedText: a plain string/number stays a string; an
 * object with en/pl becomes a bilingual value. Empty/blank → undefined so the
 * field is omitted.
 */
function locv(v: unknown): LocalizedText | undefined {
  if (v == null) return undefined;
  if (typeof v !== 'object') {
    const s = str(v)?.trim();
    return s ? s : undefined;
  }
  const o = v as Record<string, unknown>;
  const en = str(o.en)?.trim();
  const pl = str(o.pl)?.trim();
  const out: { en?: string; pl?: string } = {};
  if (en) out.en = en;
  if (pl) out.pl = pl;
  return out.en || out.pl ? out : undefined;
}

function rows<T>(v: unknown, map: (o: Record<string, unknown>) => T | undefined): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (item && typeof item === 'object') {
      const row = map(item as Record<string, unknown>);
      if (row) out.push(row);
    }
  }
  return out;
}

function coerceSpell(o: Record<string, unknown>): SpellImport | undefined {
  const name = locv(o.name);
  const cost = locv(o.cost);
  const castingTime = locv(o.castingTime ?? o.casting_time ?? o.time);
  const altNames = locv(o.altNames ?? o.alt_names ?? o.alternativeNames);
  const description = locv(o.description ?? o.desc ?? o.effect);
  if (!name && !description) return undefined;
  return {
    name: name ?? 'Untitled spell',
    ...(cost && { cost }),
    ...(castingTime && { castingTime }),
    ...(altNames && { altNames }),
    ...(description && { description }),
  };
}

function coerceNpc(o: Record<string, unknown>): NpcImport | undefined {
  const name = locv(o.name);
  if (!name) return undefined;
  const dispRaw = str(o.disposition)?.toLowerCase() as Disposition | undefined;
  const npc: NpcImport = { name };
  const role = locv(o.role);
  if (role) npc.role = role;
  if (dispRaw && DISPOSITIONS.includes(dispRaw)) npc.disposition = dispRaw;
  for (const k of ['voice', 'publicBlurb', 'gmNotes', 'armor', 'sanityLoss'] as const) {
    const v = locv(o[k]);
    if (v) npc[k] = v;
  }
  const stats = rows(o.stats, (r) => {
    const key = locv(r.key ?? r.name);
    const val = locv(r.val ?? r.value);
    return key || val ? { key: key ?? '', val: val ?? '' } : undefined;
  });
  if (stats.length) npc.stats = stats;
  const attacks = rows(o.attacks, (r) => {
    const name2 = locv(r.name);
    const chance = locv(r.chance ?? r.percent);
    const damage = locv(r.damage);
    if (!name2 && !chance && !damage) return undefined;
    return { name: name2 ?? '', ...(chance && { chance }), ...(damage && { damage }) };
  });
  if (attacks.length) npc.attacks = attacks;
  const skills = rows(o.skills, (r) => {
    const name2 = locv(r.name);
    const value = locv(r.value ?? r.val);
    return name2 || value ? { name: name2 ?? '', ...(value && { value }) } : undefined;
  });
  if (skills.length) npc.skills = skills;
  const spells = rows(o.spells, coerceSpell);
  if (spells.length) npc.spells = spells;
  return npc;
}

export interface ParseResult<T> {
  items: T[];
  error?: string;
}

export function parseNpcs(raw: string): ParseResult<NpcImport> {
  const { items, error } = parseArray(raw);
  if (error) return { items: [], error };
  const npcs = items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map(coerceNpc)
    .filter((n): n is NpcImport => n !== undefined);
  if (npcs.length === 0) return { items: [], error: 'no-valid-npcs' };
  return { items: npcs };
}

export function parseSpells(raw: string): ParseResult<SpellImport> {
  const { items, error } = parseArray(raw);
  if (error) return { items: [], error };
  const spells = items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map(coerceSpell)
    .filter((s): s is SpellImport => s !== undefined);
  if (spells.length === 0) return { items: [], error: 'no-valid-spells' };
  return { items: spells };
}
