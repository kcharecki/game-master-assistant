import { kvGet, kvSet } from '../../lib/db';
import { notebook } from '../notebook/store.svelte';
import { aggregate, searchArchive, type ArchiveEntry, type SessionLog } from './logic';

export type { SessionLog, ArchiveEntry } from './logic';

const SEED_SESSIONS: SessionLog[] = [
  { id: 's1', title: 'Session 1: Arrival in Innsmouth', at: Date.now() - 14 * 86_400_000, summary: 'Met the harbormaster; rented rooms at the Gilman House.' },
  { id: 's2', title: 'Session 2: The Marsh Refinery', at: Date.now() - 7 * 86_400_000, summary: 'Broke into the refinery and found the strange gold.' },
];

/**
 * Campaign archive: cross-session searchable history. Aggregates the live
 * session notes (reused from the notebook store) with a persisted session log.
 * GM-only.
 */
class ArchiveStore {
  sessions = $state<SessionLog[]>(structuredClone(SEED_SESSIONS));
  query = $state('');

  /** Everything, aggregated newest-first. */
  get entries(): ArchiveEntry[] {
    return aggregate($state.snapshot(notebook.notes), $state.snapshot(this.sessions));
  }

  /** Entries matching the current query. */
  get results(): ArchiveEntry[] {
    return searchArchive(this.query, this.entries);
  }

  addSession(title: string, summary = ''): SessionLog | undefined {
    const text = title.trim();
    if (!text) return undefined;
    const s: SessionLog = { id: crypto.randomUUID(), title: text, at: Date.now(), summary: summary.trim() };
    this.sessions.push(s);
    this.persist();
    return s;
  }

  removeSession(id: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('archiveSessions', $state.snapshot(this.sessions));
  }

  async load(): Promise<void> {
    const saved = await kvGet<SessionLog[]>('archiveSessions');
    if (saved?.length) this.sessions = saved;
  }
}

export const archive = new ArchiveStore();
