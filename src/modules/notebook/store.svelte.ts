import { kvSet, kvGet } from '../../lib/db';
import { parseTags, filterNotes, allTags, type Note } from './logic';
import { generateRecap } from './recap';

export type { Note } from './logic';

const SEED: Note[] = [
  {
    id: 'n1',
    body: 'Session 1: the party arrived in #Innsmouth and met the suspicious innkeeper. #npc',
    at: Date.now() - 86_400_000,
    tags: ['innsmouth', 'npc'],
  },
];

/** Timestamped, taggable, searchable session notes (GM-only). */
class NotebookStore {
  notes = $state<Note[]>([...SEED]);
  query = $state('');
  activeTag = $state<string | undefined>(undefined);
  recap = $state<string | null>(null);

  /** Notes matching the current search + tag filter, newest first. */
  get visible(): Note[] {
    return filterNotes($state.snapshot(this.notes), this.query, this.activeTag).sort(
      (a, b) => b.at - a.at
    );
  }

  get tags(): string[] {
    return allTags($state.snapshot(this.notes));
  }

  add(body: string): Note | undefined {
    const text = body.trim();
    if (!text) return undefined;
    const note: Note = { id: crypto.randomUUID(), body: text, at: Date.now(), tags: parseTags(text) };
    this.notes.push(note);
    this.persist();
    return note;
  }

  update(id: string, body: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    note.body = body;
    note.tags = parseTags(body);
    this.persist();
  }

  remove(id: string): void {
    this.notes = this.notes.filter((n) => n.id !== id);
    this.persist();
  }

  setTag(tag: string | undefined): void {
    this.activeTag = this.activeTag === tag ? undefined : tag;
  }

  makeRecap(): void {
    this.recap = generateRecap($state.snapshot(this.notes));
  }

  persist(): void {
    void kvSet('notebookNotes', $state.snapshot(this.notes));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Note[]>('notebookNotes');
    if (saved?.length) this.notes = saved;
  }
}

export const notebook = new NotebookStore();
