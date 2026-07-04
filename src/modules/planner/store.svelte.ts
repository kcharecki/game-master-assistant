import { kvSet, kvGet } from '../../lib/db';
import { toast } from '../../lib/stores/toast.svelte';
import { t } from '../../lib/i18n';
import {
  newBeat,
  newBranch,
  newThread,
  moveBeat,
  reorderBeats,
  groupByAct,
  stepCursor,
  threadTally,
  branchTarget,
  nextBeat,
  type Beat,
  type BeatType,
  type Branch,
  type Thread,
} from './logic';

export type { Beat, Branch, Thread, BeatType, BeatStatus } from './logic';

const SEED_BEATS: Beat[] = [
  {
    id: 'b-open',
    title: 'Cold Open — The Fog Rolls In',
    type: 'intro',
    status: 'done',
    act: 'Act I · Arrival',
    boxed:
      'The mail-boat gutters into a wall of grey. Somewhere ahead a bell tolls, slow and wet, and the shore of [[Hollowmere]] resolves out of the fog.',
    body: 'Set the dread. The party has been summoned by @Mireille over the [[Hollowmere Pact]].',
    branches: [],
  },
  {
    id: 'b-chapel',
    title: 'The Drowned Chapel',
    type: 'scene',
    status: 'done',
    act: 'Act I · Arrival',
    boxed: '',
    body: 'Explore the flooded nave. A #clue: the register names the signatories of the [[Hollowmere Pact]].',
    branches: [],
  },
  {
    id: 'b-parley',
    title: 'Parley with the Ferryman',
    type: 'social',
    status: 'draft',
    act: 'Act II · The Crossing',
    boxed:
      'A skiff waits at the reed-line, and in it a figure of wet grey cloth. It does not look up. “Two to cross,” it says, “and the toll is not coin.”',
    body: 'The @Ferryman wants a name owed to the mere — press the party on the [[Hollowmere Pact]]. If they mention @Mireille, the toll softens. Watch the #toll clock — dusk raises the water.',
    cue: 'He wants a name owed to the mere, not coin. Mentioning @Mireille softens the toll.',
    mins: 15,
    branches: [
      { id: 'br-toll', cond: 'they pay the toll — a true name', to: 'The Sunken Vault' },
      { id: 'br-fight', cond: 'they refuse, or draw steel', to: "The Ferryman's Wrath" },
    ],
  },
  {
    id: 'b-vault',
    title: 'The Sunken Vault',
    type: 'combat',
    status: 'planned',
    act: 'Act II · The Crossing',
    boxed: '',
    body: 'Guardians of drowned stone stir. Terrain: rising water each round.',
    mins: 25,
    branches: [],
  },
  {
    id: 'b-kept',
    title: 'What the Water Kept',
    type: 'reveal',
    status: 'planned',
    act: 'Act II · The Crossing',
    boxed: '',
    body: 'The vault yields the true name — and a portrait of @Mireille that is a century too old.',
    branches: [],
  },
  {
    id: 'b-bargain',
    title: 'The Bargain',
    type: 'social',
    status: 'planned',
    act: 'Act III · The Bargain',
    boxed: '',
    body: 'The mere itself bargains through @Mireille. What will the party trade to leave?',
    branches: [],
  },
  {
    id: 'b-ashes',
    title: 'Ashes on the Tide',
    type: 'scene',
    status: 'planned',
    act: 'Act III · The Bargain',
    boxed: '',
    body: 'Fallout and departure. Which threads did they leave open?',
    branches: [],
  },
];

const SEED_THREADS: Thread[] = [
  { id: 't-pact', text: 'Who signed the Hollowmere Pact?', resolved: false, planted: 'S1' },
  { id: 't-sister', text: "Mireille's missing sister", resolved: false, planted: 'S2' },
  { id: 't-dusk', text: 'Why does the water rise at dusk?', resolved: false, planted: 'S2' },
  { id: 't-name', text: "The Ferryman's true name", resolved: true, planted: 'S3' },
];

interface PlannerState {
  beats: Beat[];
  threads: Thread[];
  campaign?: string;
  session?: string;
  currentId?: string;
  selectedId?: string;
}

/** Scene/beat planner with branching player-action forks + plot threads. */
class PlannerStore {
  beats = $state<Beat[]>([...SEED_BEATS]);
  threads = $state<Thread[]>([...SEED_THREADS]);
  /** campaign + session labels shown in the editor titlebar */
  campaign = $state<string>('Hollowmere');
  session = $state<string>('Session 3');
  /** beat expanded in the accordion / open in the detail pane */
  selectedId = $state<string>('b-parley');
  /** beat the run cursor is parked on (the "now playing" beat) */
  currentId = $state<string>('b-parley');

  get selected(): Beat | undefined {
    return this.beats.find((b) => b.id === this.selectedId);
  }

  get current(): Beat | undefined {
    return this.beats.find((b) => b.id === this.currentId);
  }

  /** Beats bucketed into consecutive act groups, for the rail. */
  get acts() {
    return groupByAct($state.snapshot(this.beats));
  }

  /** The beat after the run cursor — the "Next →" peek. */
  get next(): Beat | undefined {
    return nextBeat($state.snapshot(this.beats), this.currentId);
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

  /** Drag-and-drop: drop the dragged beat onto the row of `toId`. */
  reorder(fromId: string, toId: string): void {
    this.beats = reorderBeats($state.snapshot(this.beats), fromId, toId);
    this.persist();
  }

  /** Flip a beat between "done" and "planned" (the rail check circle). */
  toggleDone(id: string): void {
    const beat = this.beats.find((b) => b.id === id);
    if (beat) beat.status = beat.status === 'done' ? 'planned' : 'done';
    this.persist();
  }

  select(id: string): void {
    // '' collapses the accordion (nothing expanded); any real id expands it.
    if (id === '' || this.beats.some((b) => b.id === id)) this.selectedId = id;
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

  /** Wipe the saved plan back to the bundled Hollowmere sample (undoable). */
  reset(): void {
    const prevBeats = $state.snapshot(this.beats);
    const prevThreads = $state.snapshot(this.threads);
    const prev = {
      campaign: this.campaign,
      session: this.session,
      currentId: this.currentId,
      selectedId: this.selectedId,
    };
    this.beats = structuredClone(SEED_BEATS);
    this.threads = structuredClone(SEED_THREADS);
    this.campaign = 'Hollowmere';
    this.session = 'Session 3';
    this.currentId = 'b-parley';
    this.selectedId = 'b-parley';
    this.persist();
    toast.undoable(t('planner.reset'), () => {
      this.beats = prevBeats as Beat[];
      this.threads = prevThreads as Thread[];
      this.campaign = prev.campaign;
      this.session = prev.session;
      this.currentId = prev.currentId;
      this.selectedId = prev.selectedId;
      this.persist();
    });
  }

  // --- Persistence ----------------------------------------------------------

  persist(): void {
    const state: PlannerState = {
      beats: $state.snapshot(this.beats),
      threads: $state.snapshot(this.threads),
      campaign: this.campaign,
      session: this.session,
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
      if (saved.campaign !== undefined) this.campaign = saved.campaign;
      if (saved.session !== undefined) this.session = saved.session;
      const has = (id: string | undefined) => !!id && saved.beats.some((b) => b.id === id);
      this.selectedId = has(saved.selectedId) ? saved.selectedId! : saved.beats[0].id;
      this.currentId = has(saved.currentId) ? saved.currentId! : saved.beats[0].id;
    }
  }
}

export const planner = new PlannerStore();
