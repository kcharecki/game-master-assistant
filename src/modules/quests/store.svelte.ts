import { kvSet, kvGet } from '../../lib/db';
import { counts, byStatus, type Quest, type QuestStatus, type QuestCounts } from './logic';

export type { Quest, QuestStatus } from './logic';

const SEED: Quest[] = [
  {
    id: 'q1',
    title: 'The Innsmouth Gold',
    status: 'open',
    clues: ['Refinery ledger', 'Strange coin'],
    notes: 'Where does the gold really come from?',
  },
  {
    id: 'q2',
    title: 'The Missing Fisherman',
    status: 'resolved',
    clues: ['Empty boat'],
    notes: '',
  },
];

/** Quest & plot-thread tracker: open/resolve threads, collect clues (GM-only). */
class QuestsStore {
  quests = $state<Quest[]>(structuredClone(SEED));

  get counts(): QuestCounts {
    return counts($state.snapshot(this.quests));
  }

  group(status: QuestStatus): Quest[] {
    return byStatus($state.snapshot(this.quests), status);
  }

  add(title = 'New thread'): Quest {
    const quest: Quest = { id: crypto.randomUUID(), title, status: 'open', clues: [], notes: '' };
    this.quests.push(quest);
    this.persist();
    return quest;
  }

  setStatus(id: string, status: QuestStatus): void {
    const q = this.quests.find((x) => x.id === id);
    if (q) q.status = status;
    this.persist();
  }

  toggleStatus(id: string): void {
    const q = this.quests.find((x) => x.id === id);
    if (q) this.setStatus(id, q.status === 'open' ? 'resolved' : 'open');
  }

  addClue(id: string, clue: string): void {
    const text = clue.trim();
    const q = this.quests.find((x) => x.id === id);
    if (q && text) q.clues.push(text);
    this.persist();
  }

  update(id: string, patch: Partial<Pick<Quest, 'title' | 'notes'>>): void {
    const q = this.quests.find((x) => x.id === id);
    if (q) Object.assign(q, patch);
    this.persist();
  }

  remove(id: string): void {
    this.quests = this.quests.filter((q) => q.id !== id);
    this.persist();
  }

  persist(): void {
    void kvSet('quests', $state.snapshot(this.quests));
  }

  async load(): Promise<void> {
    const saved = await kvGet<Quest[]>('quests');
    if (saved?.length) this.quests = saved;
  }
}

export const quests = new QuestsStore();
