import type { Note } from './logic';

/**
 * Build a "previously on…" recap from session notes. Takes the most recent
 * `limit` notes (by timestamp), oldest-first, and joins their first lines into
 * a short bulleted summary. Pure — unit-tested, no DOM, notes passed in.
 */
export function generateRecap(notes: Note[], limit = 5): string {
  const recent = [...notes]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .reverse();
  if (recent.length === 0) return 'Previously on… nothing recorded yet.';
  const lines = recent.map((n) => `• ${firstLine(n.body)}`);
  return ['Previously on…', ...lines].join('\n');
}

function firstLine(body: string): string {
  const line = body.split('\n')[0].trim();
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}
