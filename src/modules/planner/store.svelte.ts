import { kvSet, kvGet } from '../../lib/db';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';
import {
  newBeat,
  newBranch,
  newThread,
  moveBeat,
  stepCursor,
  threadTally,
  branchTarget,
  type Beat,
  type BeatType,
  type Branch,
  type Thread,
} from './logic';

export type { Beat, Branch, Thread, BeatType, BeatStatus } from './logic';

const SEED_BEATS: Beat[] = [
  {
    id: 'b-open',
    title: 'Cold open',
    type: 'intro',
    status: 'planned',
    boxed:
      'The mail-boat groans against the tide as Innsmouth slides into view — sagging rooftops, a church with no cross, and every window watching.',
    body: 'Set the dread. Reference [[Innsmouth]] and the [[Marsh Refinery]] on the skyline.',
    branches: [
      { id: 'br-1', cond: 'they question the driver', to: 'The nervous driver' },
      { id: 'br-2', cond: 'ready to explore', to: 'The Innkeeper' },
    ],
  },
  {
    id: 'b-inn',
    title: 'The Innkeeper',
    type: 'social',
    status: 'planned',
    boxed: 'Zadok Allen is drunk by noon and full of warnings — for the price of whiskey.',
    body: 'Play @Zadok Allen paranoid but sharp. The @Gilman Clerk listens from the stairwell.',
    branches: [
      { id: 'br-3', cond: 'buy Zadok a drink', to: "Zadok's tale (read-aloud)" },
      { id: 'br-4', cond: 'threaten him', to: 'He panics and flees' },
    ],
  },
];

const SEED_THREADS: Thread[] = [
  { id: 't-1', text: 'Who is bankrolling the refinery?', resolved: false, planted: 'S2' },
  { id: 't-2', text: 'The missing dockworkers', resolved: false, planted: 'S3' },
];

interface PlannerState {
  beats: Beat[];
  threads: Thread[];
  currentId?: string;
  selectedId?: string;
}

/** Scene/beat planner with branching player-action forks + plot threads. */
class PlannerStore {
  beats = $state<Beat[]>([...SEED_BEATS]);
  threads = $state<Thread[]>([...SEED_THREADS]);
  /** beat open in the detail pane */
  selectedId = $state<string>(SEED_BEATS[0].id);
  /** beat the run cursor is parked on (the "now playing" beat) */
  currentId = $state<string>(SEED_BEATS[0].id);

  get selected(): Beat | undefined {
    return this.beats.find((b) => b.id === this.selectedId);
  }

  get current(): Beat | undefined {
    return this.beats.find((b) => b.id === this.currentId);
  }

  /** 1-based position of the run cursor, for "3 / 7" readouts. */
  get cursorPos(): number {
    const i = this.beats.findIndex((b) => b.id === this.currentId);
    return i < 0 ? 0 : i + 1;
  }

  get tally(): { open: number; resolved: number } {
    return threadTally($state.snapshot(this.threads));
  }

  // --- Beats ----------------------------------------------------------------

  addBeat(title: string, type: BeatType = 'scene'): Beat {
    const beat = newBeat(title.trim() || t('planner.newBeat'), type);
    this.beats.push(beat);
    this.selectedId = beat.id;
    this.persist();
    return beat;
  }

  updateBeat(id: string, patch: Partial<Omit<Beat, 'id' | 'branches'>>): void {
    const beat = this.beats.find((b) => b.id === id);
    if (beat) Object.assign(beat, patch);
    this.persist();
  }

  removeBeat(id: string): void {
    const i = this.beats.findIndex((b) => b.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.beats[i]) as Beat;
    this.beats = this.beats.filter((b) => b.id !== id);
    if (this.selectedId === id) this.selectedId = this.beats[0]?.id ?? '';
    if (this.currentId === id) this.currentId = this.beats[0]?.id ?? '';
    this.persist();
    toast.undoable(t('planner.beatRemoved'), () => {
      const back = this.beats.slice();
      back.splice(Math.min(i, back.length), 0, removed);
      this.beats = back;
      this.persist();
    });
  }

  move(id: string, dir: -1 | 1): void {
    this.beats = moveBeat($state.snapshot(this.beats), id, dir);
    this.persist();
  }

  select(id: string): void {
    if (this.beats.some((b) => b.id === id)) this.selectedId = id;
  }

  // --- Run cursor -----------------------------------------------------------

  step(dir: -1 | 1): void {
    const id = stepCursor($state.snapshot(this.beats), this.currentId, dir);
    if (!id) return;
    this.currentId = id;
    this.selectedId = id;
    this.persist();
  }

  setCurrent(id: string): void {
    if (!this.beats.some((b) => b.id === id)) return;
    this.currentId = id;
    this.persist();
  }

  /** Beat id a branch's `to` points at, or undefined for a terminal outcome. */
  branchTargetId(to: string): string | undefined {
    return branchTarget($state.snapshot(this.beats), to);
  }

  /** Move both the run cursor and the detail selection to a beat. */
  jumpTo(id: string): void {
    if (!this.beats.some((b) => b.id === id)) return;
    this.currentId = id;
    this.selectedId = id;
    this.persist();
  }

  // --- Branches -------------------------------------------------------------

  addBranch(beatId: string): void {
    const beat = this.beats.find((b) => b.id === beatId);
    if (!beat) return;
    beat.branches.push(newBranch());
    this.persist();
  }

  updateBranch(beatId: string, branchId: string, patch: Partial<Omit<Branch, 'id'>>): void {
    const beat = this.beats.find((b) => b.id === beatId);
    const branch = beat?.branches.find((x) => x.id === branchId);
    if (branch) Object.assign(branch, patch);
    this.persist();
  }

  removeBranch(beatId: string, branchId: string): void {
    const beat = this.beats.find((b) => b.id === beatId);
    if (!beat) return;
    beat.branches = beat.branches.filter((x) => x.id !== branchId);
    this.persist();
  }

  // --- Threads --------------------------------------------------------------

  addThread(text: string): void {
    const body = text.trim();
    if (!body) return;
    this.threads.push(newThread(body));
    this.persist();
  }

  toggleThread(id: string): void {
    const thread = this.threads.find((x) => x.id === id);
    if (thread) thread.resolved = !thread.resolved;
    this.persist();
  }

  removeThread(id: string): void {
    this.threads = this.threads.filter((x) => x.id !== id);
    this.persist();
  }

  // --- Persistence ----------------------------------------------------------

  persist(): void {
    const state: PlannerState = {
      beats: $state.snapshot(this.beats),
      threads: $state.snapshot(this.threads),
      currentId: this.currentId,
      selectedId: this.selectedId,
    };
    void kvSet('plannerState', state);
  }

  #loaded = false;

  /**
   * Hydrate once from IndexedDB. Both surfaces (Editor + Desktop widget) call
   * this on mount, so the guard stops a second mount from clobbering the live
   * run cursor. Restores the saved cursor/selection, not just the first beat.
   */
  async load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    const saved = await kvGet<PlannerState>('plannerState');
    if (saved?.beats?.length) {
      this.beats = saved.beats;
      this.threads = saved.threads ?? [];
      const has = (id: string | undefined) => !!id && saved.beats.some((b) => b.id === id);
      this.selectedId = has(saved.selectedId) ? saved.selectedId! : saved.beats[0].id;
      this.currentId = has(saved.currentId) ? saved.currentId! : saved.beats[0].id;
    }
  }
}

export const planner = new PlannerStore();
