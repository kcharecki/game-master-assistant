import type { Disposition } from './store.svelte';

// Import shapes carry NO ids — the store mints them. LLMs (or the GM) produce
// these from a photo of a stat block; see the *_PROMPT strings below.
export interface SpellImport {
  name: string;
  cost?: string;
  castingTime?: string;
  altNames?: string;
  description?: string;
}

export interface NpcImport {
  name: string;
  role?: string;
  disposition?: Disposition;
  voice?: string;
  publicBlurb?: string;
  gmNotes?: string;
  stats?: { key: string; val: string }[];
  attacks?: { name: string; chance?: string; damage?: string }[];
  skills?: { name: string; value?: string }[];
  armor?: string;
  sanityLoss?: string;
  spells?: SpellImport[];
}

const DISPOSITIONS: Disposition[] = ['ally', 'neutral', 'hostile'];

/** The LLM prompt a GM copies, then pastes alongside a photo of a stat block. */
export const NPC_PROMPT = `You are given a photo of a tabletop RPG NPC or monster stat block (e.g. Call of Cthulhu 7e or D&D 5e), possibly in another language. Extract everything and output ONLY valid JSON — no markdown, no commentary — matching this schema:

{
  "name": "string",
  "role": "string (short title / role / location)",
  "disposition": "ally | neutral | hostile",
  "voice": "string (voice / accent / mannerism notes)",
  "publicBlurb": "string (what players may see)",
  "gmNotes": "string (secrets, GM-only)",
  "stats": [ { "key": "string (STR, CON, HP, MP, DB, Build, Move…)", "val": "string" } ],
  "attacks": [ { "name": "string", "chance": "string (e.g. 70% or +5)", "damage": "string" } ],
  "skills": [ { "name": "string", "value": "string (e.g. 50%)" } ],
  "armor": "string",
  "sanityLoss": "string (e.g. 1/1d8)",
  "spells": [ { "name": "string", "cost": "string", "castingTime": "string", "altNames": "string (;-separated)", "description": "string" } ]
}

Rules: keep all values as strings. Omit any field you cannot read — do not invent data. For several creatures, output a JSON array of such objects. Return the JSON only.`;

/** The LLM prompt for spells only. */
export const SPELL_PROMPT = `You are given a photo of one or more tabletop RPG spells (e.g. Call of Cthulhu 7e), possibly in another language. Extract them and output ONLY valid JSON — no markdown, no commentary — matching this schema:

{
  "name": "string",
  "cost": "string (magic points / sanity cost)",
  "castingTime": "string (e.g. 1 round, 1 day)",
  "altNames": "string (alternative names, ;-separated)",
  "description": "string (effect / description)"
}

Rules: keep all values as strings. Omit any field you cannot read. For several spells, output a JSON array of such objects. Return the JSON only.`;

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
  const name = str(o.name)?.trim();
  const cost = str(o.cost);
  const castingTime = str(o.castingTime ?? o.casting_time ?? o.time);
  const altNames = str(o.altNames ?? o.alt_names ?? o.alternativeNames);
  const description = str(o.description ?? o.desc ?? o.effect);
  if (!name && !description) return undefined;
  return {
    name: name || 'Untitled spell',
    ...(cost !== undefined && { cost }),
    ...(castingTime !== undefined && { castingTime }),
    ...(altNames !== undefined && { altNames }),
    ...(description !== undefined && { description }),
  };
}

function coerceNpc(o: Record<string, unknown>): NpcImport | undefined {
  const name = str(o.name)?.trim();
  if (!name) return undefined;
  const dispRaw = str(o.disposition)?.toLowerCase() as Disposition | undefined;
  const npc: NpcImport = { name };
  const role = str(o.role);
  if (role !== undefined) npc.role = role;
  if (dispRaw && DISPOSITIONS.includes(dispRaw)) npc.disposition = dispRaw;
  for (const k of ['voice', 'publicBlurb', 'gmNotes', 'armor', 'sanityLoss'] as const) {
    const v = str(o[k]);
    if (v !== undefined) npc[k] = v;
  }
  const stats = rows(o.stats, (r) => {
    const key = str(r.key ?? r.name);
    const val = str(r.val ?? r.value);
    return key || val ? { key: key ?? '', val: val ?? '' } : undefined;
  });
  if (stats.length) npc.stats = stats;
  const attacks = rows(o.attacks, (r) => {
    const name2 = str(r.name);
    if (!name2 && !r.chance && !r.damage) return undefined;
    const chance = str(r.chance ?? r.percent);
    const damage = str(r.damage);
    return {
      name: name2 ?? '',
      ...(chance !== undefined && { chance }),
      ...(damage !== undefined && { damage }),
    };
  });
  if (attacks.length) npc.attacks = attacks;
  const skills = rows(o.skills, (r) => {
    const name2 = str(r.name);
    const value = str(r.value ?? r.val);
    return name2 || value ? { name: name2 ?? '', ...(value !== undefined && { value }) } : undefined;
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
