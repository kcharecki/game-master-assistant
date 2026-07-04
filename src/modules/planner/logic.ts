import { parseMentions, linkTargets } from '../notebook/logic';

export type BeatType = 'intro' | 'scene' | 'social' | 'combat' | 'reveal';
export type BeatStatus = 'planned' | 'draft' | 'done';

export const BEAT_TYPES: BeatType[] = ['intro', 'scene', 'social', 'combat', 'reveal'];
export const BEAT_STATUSES: BeatStatus[] = ['planned', 'draft', 'done'];

/** One "if players… then…" fork hanging off a beat. */
export interface Branch {
  id: string;
  /** the trigger condition, e.g. "buy Zadok a drink" */
  cond: string;
  /** where it leads — a beat title or free-text outcome */
  to: string;
}

/** A single planned moment of the session. */
export interface Beat {
  id: string;
  title: string;
  type: BeatType;
  status: BeatStatus;
  /** act grouping label, e.g. "Act II · The Crossing"; blank = ungrouped */
  act?: string;
  /** player-facing narration, shown as "read aloud" boxed text */
  boxed: string;
  /** GM-only notes; supports #tags, @npc, [[lore]] via the notebook renderer */
  body: string;
  /** one-line glance cue for the run cockpit (not read-aloud) */
  cue?: string;
  /** rough time budget in minutes for this beat */
  mins?: number;
  branches: Branch[];
}

/** A run of consecutive beats sharing an act label, for grouped rendering. */
export interface ActGroup {
  act: string;
  beats: Beat[];
}

/** A plot thread / open question tracked across the whole campaign. */
export interface Thread {
  id: string;
  text: string;
  resolved: boolean;
  /** free label of where it was planted, e.g. "S2" */
  planted?: string;
}

/** A cross-module reference pulled out of a beat body. */
export interface BeatRef {
  kind: 'npc' | 'lore';
  name: string;
}

export function newBeat(title: string, type: BeatType = 'scene'): Beat {
  return { id: crypto.randomUUID(), title, type, status: 'planned', boxed: '', body: '', branches: [] };
}

export function newBranch(cond = '', to = ''): Branch {
  return { id: crypto.randomUUID(), cond, to };
}

export function newThread(text: string): Thread {
  return { id: crypto.randomUUID(), text, resolved: false };
}

/**
 * Move the beat with `id` one slot up (-1) or down (+1). Returns a new array;
 * out-of-range moves return the input unchanged. Pure — unit-tested.
 */
export function moveBeat(beats: Beat[], id: string, dir: -1 | 1): Beat[] {
  const i = beats.findIndex((b) => b.id === id);
  if (i < 0) return beats;
  const j = i + dir;
  if (j < 0 || j >= beats.length) return beats;
  const out = beats.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * Move the beat `fromId` to sit where `toId` currently is (drag-and-drop
 * reorder). Returns a new array; unknown ids or a no-op self-move return the
 * input unchanged. Pure — unit-tested.
 */
export function reorderBeats(beats: Beat[], fromId: string, toId: string): Beat[] {
  if (fromId === toId) return beats;
  const from = beats.findIndex((b) => b.id === fromId);
  const to = beats.findIndex((b) => b.id === toId);
  if (from < 0 || to < 0) return beats;
  const out = beats.slice();
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved);
  return out;
}

/**
 * Bucket beats into consecutive runs sharing an act label. Beats with no act
 * fall into a group keyed by the empty string (rendered header-less). Pure.
 */
export function groupByAct(beats: Beat[]): ActGroup[] {
  const groups: ActGroup[] = [];
  for (const b of beats) {
    const act = b.act?.trim() ?? '';
    const last = groups[groups.length - 1];
    if (last && last.act === act) last.beats.push(b);
    else groups.push({ act, beats: [b] });
  }
  return groups;
}

/** The first non-empty line of a beat body — the run cockpit's glance cue. Pure. */
export function beatCue(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** The beat immediately after `currentId`, or undefined at the end. Pure. */
export function nextBeat(beats: Beat[], currentId: string | undefined): Beat | undefined {
  const i = beats.findIndex((b) => b.id === currentId);
  if (i < 0 || i + 1 >= beats.length) return undefined;
  return beats[i + 1];
}

/**
 * Step the run cursor from `currentId` by `dir`, clamped to the ends. Returns
 * the id of the resulting beat, or undefined for an empty list. Pure.
 */
export function stepCursor(beats: Beat[], currentId: string | undefined, dir: -1 | 1): string | undefined {
  if (beats.length === 0) return undefined;
  const i = beats.findIndex((b) => b.id === currentId);
  if (i < 0) return dir > 0 ? beats[0].id : beats[beats.length - 1].id;
  const j = Math.min(beats.length - 1, Math.max(0, i + dir));
  return beats[j].id;
}

/**
 * Distinct @npc mentions and [[lore]] links found in a beat body, in order of
 * first appearance (mentions first, then links). Reuses the notebook parsers so
 * planner references and note references stay in lock-step. Pure.
 */
export function beatRefs(body: string): BeatRef[] {
  const refs: BeatRef[] = [];
  for (const n of parseMentions(body)) refs.push({ kind: 'npc', name: n });
  for (const n of linkTargets(body)) refs.push({ kind: 'lore', name: n });
  return refs;
}

/**
 * Resolve a branch's `to` label to a beat id by matching it against beat titles
 * (case- and whitespace-insensitive). Returns undefined when `to` is a terminal
 * outcome with no matching beat (e.g. "He panics and flees"). Pure.
 */
export function branchTarget(beats: Beat[], to: string): string | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const want = norm(to);
  if (!want) return undefined;
  return beats.find((b) => norm(b.title) === want)?.id;
}

/** Count of open vs. resolved threads, for the header tally. */
export function threadTally(threads: Thread[]): { open: number; resolved: number } {
  let open = 0;
  let resolved = 0;
  for (const t of threads) {
    if (t.resolved) resolved++;
    else open++;
  }
  return { open, resolved };
}
