export interface Note {
  id: string;
  body: string;
  at: number;
  tags: string[];
}

const TAG_RE = /#([a-z0-9][a-z0-9_-]*)/gi;

/**
 * Extract `#tags` from a note body — lower-cased and de-duplicated, order of
 * first appearance preserved. Pure — unit-tested, no DOM.
 */
export function parseTags(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Filter notes by free text and/or an active tag. Text match is
 * case-insensitive against the body; tag match is exact (case-insensitive).
 * Both filters are AND-combined; empty filters pass everything.
 */
export function filterNotes(notes: Note[], query: string, tag?: string): Note[] {
  const q = query.trim().toLowerCase();
  const t = tag?.trim().toLowerCase();
  return notes.filter((n) => {
    const textOk = !q || n.body.toLowerCase().includes(q);
    const tagOk = !t || n.tags.includes(t);
    return textOk && tagOk;
  });
}

/** All distinct tags across notes, sorted alphabetically. */
export function allTags(notes: Note[]): string[] {
  const set = new Set<string>();
  for (const n of notes) for (const tag of n.tags) set.add(tag);
  return [...set].sort();
}
