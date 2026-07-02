/**
 * Command-palette VERB parsing. A verb turns a typed line into a structured
 * intent the palette component dispatches to the right module's bus action.
 * Everything here is PURE (no DOM, no store side effects) so it's unit-tested.
 *
 * Supported forms (case-insensitive, leading/trailing space tolerated):
 *   air scene 2            → { kind:'airScene', index:1 }  (1-based → 0-based)
 *   air <scene name>       → { kind:'airScene', target:'<name>' }
 *   start break            → { kind:'startBreak' }
 *   mood: dread            → { kind:'mood', target:'dread' }
 *   play tavern            → { kind:'playAudio', target:'tavern' }
 *   stop audio             → { kind:'stopAudio' }
 *   sfx <name>             → { kind:'sfx', target:'<name>' }
 *   note: <text>           → { kind:'note', text:'<text>' }
 */

export type VerbIntent =
  | { kind: 'airScene'; index?: number; target?: string }
  | { kind: 'startBreak' }
  | { kind: 'mood'; target: string }
  | { kind: 'playAudio'; target: string }
  | { kind: 'stopAudio' }
  | { kind: 'sfx'; target: string }
  | { kind: 'note'; text: string };

/**
 * Parse a raw palette query into a verb intent, or null when the line isn't a
 * verb command (so the palette falls back to noun search). Pure.
 */
export function parseVerb(raw: string): VerbIntent | null {
  const line = raw.trim();
  if (!line) return null;
  const lower = line.toLowerCase();

  // note: <text> — keep the original casing of the note text.
  const noteM = /^note\s*:\s*(.+)$/i.exec(line);
  if (noteM) return { kind: 'note', text: noteM[1].trim() };

  // mood: <id or label>
  const moodM = /^mood\s*:?\s+(.+)$/i.exec(line);
  if (moodM) return { kind: 'mood', target: moodM[1].trim() };

  // stop audio / stop ambient
  if (/^stop\s+(audio|ambient|music|sound)$/i.test(lower)) return { kind: 'stopAudio' };

  // start break / start timer break
  if (/^(start|take)\s+(a\s+)?break$/i.test(lower)) return { kind: 'startBreak' };

  // air scene <n> | air <name> | air scene <name>
  const airM = /^air\s+(.+)$/i.exec(line);
  if (airM) {
    let rest = airM[1].trim();
    // strip a leading "scene" keyword if present (with or without trailing args)
    rest = rest.replace(/^scene\b\s*/i, '').trim();
    if (!rest) return null;
    const n = Number(rest);
    if (Number.isInteger(n) && n >= 1) return { kind: 'airScene', index: n - 1 };
    return { kind: 'airScene', target: rest };
  }

  // play <playlist/scene name>
  const playM = /^play\s+(.+)$/i.exec(line);
  if (playM) {
    const target = playM[1].trim();
    if (target) return { kind: 'playAudio', target };
  }

  // sfx <name>
  const sfxM = /^sfx\s+(.+)$/i.exec(line);
  if (sfxM) {
    const target = sfxM[1].trim();
    if (target) return { kind: 'sfx', target };
  }

  return null;
}

/** A candidate the fuzzy matcher ranks by name. */
export interface NamedTarget {
  id: string;
  name: string;
}

/**
 * Fuzzy match `query` against a list of named targets. Ranking (best→worst):
 * exact (case-insensitive) · prefix · word-start · substring. Returns the best
 * match or null. Ties broken by shorter name then A→Z (stable, deterministic).
 * Pure — unit-tested.
 */
export function matchTarget<T extends NamedTarget>(targets: T[], query: string): T | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let best: { t: T; score: number } | null = null;
  for (const t of targets) {
    const name = t.name.toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 60;
    else if (name.includes(q)) score = 40;
    if (score === 0) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        (t.name.length < best.t.name.length ||
          (t.name.length === best.t.name.length && t.name.localeCompare(best.t.name) < 0)))
    ) {
      best = { t, score };
    }
  }
  return best?.t ?? null;
}
