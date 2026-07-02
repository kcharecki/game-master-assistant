import { kvSet, kvGet } from '../../lib/db';
import type { BroadcastPayload } from '../../lib/types';
import { describeOnAir } from '../../lib/onair';
import { initiative } from '../initiative/store.svelte';
import { calendar } from '../calendar/store.svelte';
import { npcs } from '../npcs/store.svelte';
import {
  parseTags,
  filterNotes,
  allTags,
  activeNotes,
  groupBySession,
  renameTag as renameTagPure,
  toggleTodo,
  type Note,
  type NoteContext,
  type SessionGroup,
} from './logic';
import { generateRecap } from './recap';

export type { Note, NoteContext } from './logic';

const SEED: Note[] = [
  {
    id: 'n1',
    body: 'Session 1: the party arrived in #Innsmouth and met the suspicious innkeeper. #npc',
    at: Date.now() - 86_400_000,
    tags: ['innsmouth', 'npc'],
  },
];

/** Short human label of whatever is currently on air, for the context stamp. */
function onAirLabel(p: BroadcastPayload | undefined): string | undefined {
  return describeOnAir(p).label;
}

/** Timestamped, taggable, searchable session notes (GM-only). */
class NotebookStore {
  notes = $state<Note[]>([...SEED]);
  query = $state('');
  activeTag = $state<string | undefined>(undefined);
  recap = $state<string | null>(null);
  /** last-deleted (archived) note id, for the undo toast */
  lastArchivedId = $state<string | null>(null);

  /** Notes matching the current search + tag filter, newest first. */
  get visible(): Note[] {
    return filterNotes($state.snapshot(this.notes), this.query, this.activeTag).sort(
      (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.at - a.at
    );
  }

  /** Filtered notes bucketed into sessions (newest session first). */
  get sessions(): SessionGroup[] {
    return groupBySession(filterNotes($state.snapshot(this.notes), this.query, this.activeTag));
  }

  get tags(): string[] {
    return allTags($state.snapshot(this.notes));
  }

  /** NPC names for `@npc` autocomplete (read-only from the roster). */
  get npcNames(): string[] {
    return $state.snapshot(npcs.list).map((n) => n.name);
  }

  /** Best-effort snapshot of the live table state at save time. */
  #stamp(): NoteContext {
    const ctx: NoteContext = {};
    const inFight = initiative.order.length > 0 && initiative.round >= 1;
    if (inFight) ctx.round = initiative.round;
    const iv = calendar.label;
    if (iv) ctx.ivDate = iv;
    // on-air label is loaded async into #onAir; may be undefined early on.
    if (this.#onAir) ctx.onAir = this.#onAir;
    return ctx;
  }

  #onAir: string | undefined = undefined;

  add(body: string): Note | undefined {
    const text = body.trim();
    if (!text) return undefined;
    const note: Note = {
      id: crypto.randomUUID(),
      body: text,
      at: Date.now(),
      tags: parseTags(text),
      ctx: this.#stamp(),
    };
    this.notes.push(note);
    this.persist();
    return note;
  }

  /** Clean entry point for palette/global-hotkey quick capture. */
  quickCapture(text: string): Note | undefined {
    return this.add(text);
  }

  update(id: string, body: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    note.body = body;
    note.tags = parseTags(body);
    this.persist();
  }

  /** Attach (or replace) an image asset on a note. */
  attach(id: string, assetId: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    note.assetId = assetId;
    this.persist();
  }

  togglePin(id: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    note.pinned = !note.pinned;
    this.persist();
  }

  /** Toggle the n-th TODO checkbox in a note's body and rewrite it. */
  toggleTodo(id: string, index: number): void {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    note.body = toggleTodo(note.body, index);
    this.persist();
  }

  /** Soft-delete: archive + remember for undo. */
  remove(id: string): void {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    note.archived = true;
    this.lastArchivedId = id;
    this.persist();
  }

  /** Undo the most recent archive (toast action). */
  undo(): void {
    const id = this.lastArchivedId;
    if (!id) return;
    const note = this.notes.find((n) => n.id === id);
    if (note) note.archived = false;
    this.lastArchivedId = null;
    this.persist();
  }

  /** Rename or merge a tag across all notes (rewrites bodies). */
  renameTag(from: string, to: string): void {
    const dest = to.replace(/^#/, '').trim();
    if (!dest) return;
    this.notes = renameTagPure($state.snapshot(this.notes), from, dest);
    if (this.activeTag === from.replace(/^#/, '').toLowerCase()) this.activeTag = dest.toLowerCase();
    this.persist();
  }

  setTag(tag: string | undefined): void {
    this.activeTag = this.activeTag === tag ? undefined : tag;
  }

  makeRecap(): void {
    this.recap = generateRecap(activeNotes($state.snapshot(this.notes)));
  }

  persist(): void {
    void kvSet('notebookNotes', $state.snapshot(this.notes));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Note[]>('notebookNotes');
    if (saved?.length) this.notes = saved;
    const onAir = await kvGet<BroadcastPayload>('broadcastState');
    this.#onAir = onAirLabel(onAir);
  }
}

export const notebook = new NotebookStore();
