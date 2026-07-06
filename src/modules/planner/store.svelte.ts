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
  layoutGraph,
  plannedMinutes,
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
    mins: 10,
    branches: [{ id: 'br-open-next', cond: '', to: 'The Drowned Chapel' }],
  },
  {
    id: 'b-chapel',
    title: 'The Drowned Chapel',
    type: 'scene',
    status: 'done',
    act: 'Act I · Arrival',
    boxed: '',
    body: 'Explore the flooded nave. A #clue: the register names the signatories of the [[Hollowmere Pact]].',
    cue: 'The register in the nave names the Pact’s signatories.',
    mins: 10,
    branches: [
      { id: 'br-register', cond: 'they read the drowned register', to: 'Parley with the Ferryman' },
      { id: 'br-marshlight', cond: 'they follow the marsh-light', to: "The Hermit's Fire" },
    ],
  },
  {
    id: 'b-hermit',
    title: "The Hermit's Fire",
    type: 'social',
    status: 'draft',
    act: 'Act I · Arrival',
    optional: true,
    boxed: '',
    body: 'Optional. Old @Sella trades a warning for a story — she knows the @Ferryman’s price. #rumor',
    cue: 'Sella knows the Ferryman’s price — and what dusk costs.',
    mins: 10,
    branches: [{ id: 'br-hermit-on', cond: 'she points them to the crossing', to: 'Parley with the Ferryman' }],
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
      { id: 'br-name', cond: 'they offer @Mireille’s name', to: 'What the Water Kept' },
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
    cue: 'Guardians wake; water rises a foot each round.',
    mins: 25,
    branches: [
      { id: 'br-seize', cond: 'they seize the true name', to: 'What the Water Kept' },
      { id: 'br-drown', cond: 'the water closes over them', to: 'Dragged Under' },
    ],
  },
  {
    id: 'b-kept',
    title: 'What the Water Kept',
    type: 'reveal',
    status: 'planned',
    act: 'Act II · The Crossing',
    boxed: '',
    body: 'The vault yields the true name — and a portrait of @Mireille that is a century too old.',
    mins: 10,
    branches: [{ id: 'br-kept-next', cond: '', to: 'The Bargain' }],
  },
  {
    id: 'b-bargain',
    title: 'The Bargain',
    type: 'social',
    status: 'planned',
    act: 'Act III · The Bargain',
    boxed: '',
    body: 'The mere itself bargains through @Mireille. What will the party trade to leave?',
    cue: 'The mere names its price through Mireille. What will they trade?',
    mins: 15,
    branches: [
      { id: 'br-trade', cond: 'they trade a memory to the mere', to: 'Ashes on the Tide' },
      { id: 'br-break', cond: 'they break the pact and run', to: 'Parley with the Ferryman' },
    ],
  },
  {
    id: 'b-ashes',
    title: 'Ashes on the Tide',
    type: 'scene',
    status: 'planned',
    act: 'Act III · The Bargain',
    boxed: '',
    body: 'Fallout and departure. Which threads did they leave open?',
    mins: 10,
    branches: [],
  },
];

const SEED_THREADS: Thread[] = [
  { id: 't-pact', text: 'Who signed the Hollowmere Pact?', resolved: false, planted: 'S1' },
  { id: 't-sister', text: "Mireille's missing sister", resolved: false, planted: 'S2' },
  { id: 't-dusk', text: 'Why does the water rise at dusk?', resolved: false, planted: 'S2' },
  { id: 't-trade', text: 'What will the mere take in trade?', resolved: false, planted: 'S3' },
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
  /** cursor history for the cockpit BACK button — ids visited before `current` */
  trail = $state<string[]>([]);

  get selected(): Beat | undefined {
    return this.beats.find((b) => b.id === this.selectedId);
  }

  /** Command Deck session-graph layout — nodes + edges in absolute px. */
  get graph() {
    return layoutGraph($state.snapshot(this.beats), this.currentId);
  }

  /** Total planned minutes across all beats — the cockpit "Nm planned" readout. */
  get plannedMins(): number {
    return plannedMinutes($state.snapshot(this.beats));
  }

  /** The beat the cockpit BACK button would rewind to, if any. */
  get canBack(): boolean {
    return this.trail.length > 0;
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

  addBeat(title = '', type: BeatType = 'scene'): Beat {
    const beat = newBeat(this.#uniqueTitle(title.trim() || t('planner.newBeatTitle')), type);
    this.beats.push(beat);
    this.selectedId = beat.id;
    this.focusBeatId = beat.id;
    this.persist();
    return beat;
  }

  updateBeat(id: string, patch: Partial<Omit<Beat, 'id' | 'branches'>>): void {
    const beat = this.beats.find((b) => b.id === id);
    if (!beat) return;
    // Branches point at beats by title. When a title changes, follow it across
    // every branch that referenced the old one, so renaming never breaks an edge.
    // Only re-point when the new title is non-blank — otherwise a momentary
    // empty field (select-all + retype) would orphan every edge irrecoverably.
    if (patch.title !== undefined && patch.title.trim() && patch.title !== beat.title) {
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const from = norm(beat.title);
      if (from) for (const b of this.beats) for (const br of b.branches) if (norm(br.to) === from) br.to = patch.title;
    }
    Object.assign(beat, patch);
    this.persist();
  }

  removeBeat(id: string): void {
    const i = this.beats.findIndex((b) => b.id === id);
    if (i < 0) return;
    const removed = $state.snapshot(this.beats[i]) as Beat;
    this.beats = this.beats.filter((b) => b.id !== id);
    if (this.selectedId === id) this.selectedId = this.beats[0]?.id ?? '';
    if (this.currentId === id) this.currentId = this.beats[0]?.id ?? '';
    // drop the deleted beat from the run trail so BACK never rewinds onto a ghost
    this.trail = this.trail.filter((tid) => tid !== id);
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

  /** Move the run cursor to `id`, recording the previous stop on the trail. */
  #moveCursor(id: string): void {
    if (id === this.currentId) return;
    if (this.currentId) this.trail = [...this.trail, this.currentId];
    this.currentId = id;
  }

  step(dir: -1 | 1): void {
    const id = stepCursor($state.snapshot(this.beats), this.currentId, dir);
    if (!id) return;
    this.#moveCursor(id);
    this.selectedId = id;
    this.persist();
  }

  setCurrent(id: string): void {
    if (!this.beats.some((b) => b.id === id)) return;
    this.#moveCursor(id);
    this.persist();
  }

  /** Rewind the run cursor to the previous stop on the trail (cockpit BACK).
   *  Skips any trail entries whose beat no longer exists. */
  back(): void {
    let prev: string | undefined;
    while (this.trail.length) {
      const id = this.trail[this.trail.length - 1];
      this.trail = this.trail.slice(0, -1);
      if (this.beats.some((b) => b.id === id)) {
        prev = id;
        break;
      }
    }
    if (!prev) return;
    this.currentId = prev;
    this.selectedId = prev;
    this.persist();
  }

  /** Beat id a branch's `to` points at, or undefined for a terminal outcome. */
  branchTargetId(to: string): string | undefined {
    return branchTarget($state.snapshot(this.beats), to);
  }

  /** Move both the run cursor and the detail selection to a beat. */
  jumpTo(id: string): void {
    if (!this.beats.some((b) => b.id === id)) return;
    this.#moveCursor(id);
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

  /**
   * Drag-to-connect: fork `fromId` to the beat `toId` by adding a branch whose
   * `to` is that beat's title (so the graph resolves it as an edge). No-ops for
   * a self-connect or an already-existing edge to the same target.
   */
  connect(fromId: string, toId: string): void {
    if (fromId === toId) return;
    const from = this.beats.find((b) => b.id === fromId);
    const to = this.beats.find((b) => b.id === toId);
    if (!from || !to) return;
    const norm = (s: string) => s.trim().toLowerCase();
    if (from.branches.some((br) => norm(br.to) === norm(to.title))) return;
    from.branches.push(newBranch('', to.title));
    this.selectedId = fromId;
    this.persist();
  }

  /** Flip a beat's optional/side flag (dashed card in the graph). */
  toggleOptional(id: string): void {
    const beat = this.beats.find((b) => b.id === id);
    if (beat) beat.optional = !beat.optional;
    this.persist();
  }

  /** id whose inspector title input should grab focus once (fast-create flow). */
  focusBeatId = $state<string>('');

  /** A title that no existing beat uses, seeded from `base`. */
  #uniqueTitle(base: string): string {
    const norm = (s: string) => s.trim().toLowerCase();
    if (!this.beats.some((b) => norm(b.title) === norm(base))) return base;
    for (let i = 2; ; i++) {
      const cand = `${base} ${i}`;
      if (!this.beats.some((b) => norm(b.title) === norm(cand))) return cand;
    }
  }

  /**
   * Drag-to-empty: spin up a fresh beat and fork `fromId` into it in one gesture.
   * Returns the new beat id; the inspector opens on it with the title focused.
   */
  forkToNew(fromId: string): string | undefined {
    const from = this.beats.find((b) => b.id === fromId);
    if (!from) return;
    const beat = newBeat(this.#uniqueTitle(t('planner.newBeatTitle')));
    beat.type = from.type;
    this.beats.push(beat);
    from.branches.push(newBranch('', beat.title));
    this.selectedId = beat.id;
    this.focusBeatId = beat.id;
    this.persist();
    return beat.id;
  }

  /**
   * Promote a terminal outcome into a real beat: the branch's `to` now resolves
   * to a card you can flesh out. Opens the inspector on the new beat.
   */
  promoteTerminal(srcId: string, branchId: string): void {
    const from = this.beats.find((b) => b.id === srcId);
    const branch = from?.branches.find((x) => x.id === branchId);
    if (!from || !branch) return;
    const title = this.#uniqueTitle(branch.to.trim() || t('planner.newBeatTitle'));
    const beat = newBeat(title);
    branch.to = title; // keep the edge pointing at it
    this.beats.push(beat);
    this.selectedId = beat.id;
    this.focusBeatId = beat.id;
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
    this.trail = [];
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
