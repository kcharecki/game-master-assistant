import type { Note } from '../notebook/logic';

/** A logged play session — a heading the GM can search across the campaign. */
export interface SessionLog {
  id: string;
  /** session number / title, e.g. "Session 3: The Refinery" */
  title: string;
  at: number;
  summary?: string;
}

/** A unified, searchable record drawn from notes and session logs. */
export interface ArchiveEntry {
  id: string;
  source: 'note' | 'session';
  text: string;
  at: number;
  tags: string[];
}

/**
 * Flatten notes + session logs into one chronological archive (newest first).
 * Pure — unit-tested, no DOM.
 */
export function aggregate(notes: Note[], sessions: SessionLog[]): ArchiveEntry[] {
  const fromNotes: ArchiveEntry[] = notes.map((n) => ({
    id: `note-${n.id}`,
    source: 'note',
    text: n.body,
    at: n.at,
    tags: n.tags,
  }));
  const fromSessions: ArchiveEntry[] = sessions.map((s) => ({
    id: `session-${s.id}`,
    source: 'session',
    text: s.summary ? `${s.title} — ${s.summary}` : s.title,
    at: s.at,
    tags: [],
  }));
  return [...fromNotes, ...fromSessions].sort((a, b) => b.at - a.at);
}

/**
 * Free-text search across an aggregated archive (case-insensitive over text
 * and tags). Empty query returns everything. Pure — unit-tested, no DOM.
 */
export function searchArchive(query: string, entries: ArchiveEntry[]): ArchiveEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.text.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q))
  );
}
