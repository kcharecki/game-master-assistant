import { parseMentions, linkTargets } from '../notebook/logic';

export type BeatType = 'intro' | 'scene' | 'social' | 'combat' | 'reveal';
export type BeatStatus = 'planned' | 'draft' | 'done';

export const BEAT_TYPES: BeatType[] = ['intro', 'scene', 'social', 'combat', 'reveal'];
export const BEAT_STATUSES: BeatStatus[] = ['planned', 'draft', 'done'];

/** One "if players… then…" fork hanging off a beat. */
export interface Branch {
  id: string;
  /** the trigger condition, e.g. "buy Zadok a drink" */
  cond: string;
  /** where it leads — a beat title or free-text outcome */
  to: string;
}

/** A single planned moment of the session. */
export interface Beat {
  id: string;
  title: string;
  type: BeatType;
  status: BeatStatus;
  /** act grouping label, e.g. "Act II · The Crossing"; blank = ungrouped */
  act?: string;
  /** player-facing narration, shown as "read aloud" boxed text */
  boxed: string;
  /** GM-only notes; supports #tags, @npc, [[lore]] via the notebook renderer */
  body: string;
  /** one-line glance cue for the run cockpit (not read-aloud) */
  cue?: string;
  /** rough time budget in minutes for this beat */
  mins?: number;
  /** side/optional beat — reachable but skippable; drawn dashed in the graph */
  optional?: boolean;
  branches: Branch[];
}

/** A run of consecutive beats sharing an act label, for grouped rendering. */
export interface ActGroup {
  act: string;
  beats: Beat[];
}

/** A plot thread / open question tracked across the whole campaign. */
export interface Thread {
  id: string;
  text: string;
  resolved: boolean;
  /** free label of where it was planted, e.g. "S2" */
  planted?: string;
}

/** A cross-module reference pulled out of a beat body. */
export interface BeatRef {
  kind: 'npc' | 'lore';
  name: string;
}

export function newBeat(title: string, type: BeatType = 'scene'): Beat {
  return { id: crypto.randomUUID(), title, type, status: 'planned', boxed: '', body: '', branches: [] };
}

export function newBranch(cond = '', to = ''): Branch {
  return { id: crypto.randomUUID(), cond, to };
}

export function newThread(text: string): Thread {
  return { id: crypto.randomUUID(), text, resolved: false };
}

/**
 * Move the beat with `id` one slot up (-1) or down (+1). Returns a new array;
 * out-of-range moves return the input unchanged. Pure — unit-tested.
 */
export function moveBeat(beats: Beat[], id: string, dir: -1 | 1): Beat[] {
  const i = beats.findIndex((b) => b.id === id);
  if (i < 0) return beats;
  const j = i + dir;
  if (j < 0 || j >= beats.length) return beats;
  const out = beats.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * Move the beat `fromId` to sit where `toId` currently is (drag-and-drop
 * reorder). Returns a new array; unknown ids or a no-op self-move return the
 * input unchanged. Pure — unit-tested.
 */
export function reorderBeats(beats: Beat[], fromId: string, toId: string): Beat[] {
  if (fromId === toId) return beats;
  const from = beats.findIndex((b) => b.id === fromId);
  const to = beats.findIndex((b) => b.id === toId);
  if (from < 0 || to < 0) return beats;
  const out = beats.slice();
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved);
  return out;
}

/**
 * Bucket beats into consecutive runs sharing an act label. Beats with no act
 * fall into a group keyed by the empty string (rendered header-less). Pure.
 */
export function groupByAct(beats: Beat[]): ActGroup[] {
  const groups: ActGroup[] = [];
  for (const b of beats) {
    const act = b.act?.trim() ?? '';
    const last = groups[groups.length - 1];
    if (last && last.act === act) last.beats.push(b);
    else groups.push({ act, beats: [b] });
  }
  return groups;
}

/** The first non-empty line of a beat body — the run cockpit's glance cue. Pure. */
export function beatCue(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** The beat immediately after `currentId`, or undefined at the end. Pure. */
export function nextBeat(beats: Beat[], currentId: string | undefined): Beat | undefined {
  const i = beats.findIndex((b) => b.id === currentId);
  if (i < 0 || i + 1 >= beats.length) return undefined;
  return beats[i + 1];
}

/**
 * Step the run cursor from `currentId` by `dir`, clamped to the ends. Returns
 * the id of the resulting beat, or undefined for an empty list. Pure.
 */
export function stepCursor(beats: Beat[], currentId: string | undefined, dir: -1 | 1): string | undefined {
  if (beats.length === 0) return undefined;
  const i = beats.findIndex((b) => b.id === currentId);
  if (i < 0) return dir > 0 ? beats[0].id : beats[beats.length - 1].id;
  const j = Math.min(beats.length - 1, Math.max(0, i + dir));
  return beats[j].id;
}

/**
 * Distinct @npc mentions and [[lore]] links found in a beat body, in order of
 * first appearance (mentions first, then links). Reuses the notebook parsers so
 * planner references and note references stay in lock-step. Pure.
 */
export function beatRefs(body: string): BeatRef[] {
  const refs: BeatRef[] = [];
  for (const n of parseMentions(body)) refs.push({ kind: 'npc', name: n });
  for (const n of linkTargets(body)) refs.push({ kind: 'lore', name: n });
  return refs;
}

/**
 * Resolve a branch's `to` label to a beat id by matching it against beat titles
 * (case- and whitespace-insensitive). Returns undefined when `to` is a terminal
 * outcome with no matching beat (e.g. "He panics and flees"). Pure.
 */
export function branchTarget(beats: Beat[], to: string): string | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const want = norm(to);
  if (!want) return undefined;
  return beats.find((b) => norm(b.title) === want)?.id;
}

/** Sum of all beats' time budgets, in minutes — the run cockpit's "planned" total. */
export function plannedMinutes(beats: Beat[]): number {
  return beats.reduce((sum, b) => sum + (b.mins ?? 0), 0);
}

// --- Session graph (Command Deck) ------------------------------------------
// Auto-layout: beats sit on a flat left→right spine (x by index, no manual
// positioning). A beat's outgoing edges are its branches if it has any, else a
// single sequential edge to the next beat. Branches that resolve to a beat draw
// a curved edge to that card (forward = fork/converge, backward = loop-back,
// routed low + dashed). Branches with no matching beat spawn a small terminal
// outcome card in an alternating up/down side lane. Pure — unit-tested.

export type GraphEdgeKind = 'seq' | 'fork' | 'loop' | 'terminal';

export interface GraphNode {
  /** node id — beat id, or `term:<beatId>:<branchId>` for a terminal outcome */
  id: string;
  kind: 'beat' | 'terminal';
  beatId?: string;
  /** for a terminal card: the beat + branch it was spawned from (editable) */
  srcId?: string;
  branchId?: string;
  /** beat type, or 'terminal' for outcome cards */
  type: BeatType | 'terminal';
  title: string;
  mins?: number;
  status?: BeatStatus;
  optional?: boolean;
  cursor: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** SVG cubic-bezier path data */
  d: string;
  label?: string;
  kind: GraphEdgeKind;
  /** originates from the run-cursor beat — drawn in bright gold */
  cursor: boolean;
  /** label pill anchor (mid-curve) */
  lx: number;
  ly: number;
}

export interface GraphView {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

const G_W = 172; // card width
const G_H = 64; // card height
const G_COLGAP = 152; // horizontal gap between columns (room for a label pill)
const G_ROWGAP = 56; // vertical gap between rows
const G_PADX = 26;
const G_PADY = 30;
const G_COLW = G_W + G_COLGAP; // column pitch
const G_ROWH = G_H + G_ROWGAP; // row pitch

/** Raw adjacency edge, before geometry. */
interface RawEdge {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
  label?: string;
  cursor: boolean;
}

/** A one-column S-curve; returns path + mid-point for the label. */
function curve(sx: number, sy: number, ex: number, ey: number): { d: string; mx: number; my: number } {
  const dx = Math.max(24, (ex - sx) * 0.5);
  return {
    d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`,
    mx: (sx + ex) / 2,
    my: (sy + ey) / 2,
  };
}

/** A long edge lifted into a clear horizontal lane (`laneY`) so it never
 *  crosses the cards in the columns it spans. Label rides the flat run. */
function lanePath(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  laneY: number
): { d: string; mx: number; my: number } {
  const dx = Math.max(20, G_COLGAP * 0.4);
  const ax = sx + dx * 1.4;
  const bx = ex - dx * 1.4;
  const d =
    `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ax - dx} ${laneY}, ${ax} ${laneY} ` +
    `L ${bx} ${laneY} ` +
    `C ${bx + dx} ${laneY}, ${ex - dx} ${ey}, ${ex} ${ey}`;
  return { d, mx: (ax + bx) / 2, my: laneY };
}

/** A back-edge routed under everything in a bottom lane, dashed. */
function loopPath(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  laneY: number
): { d: string; mx: number; my: number } {
  const k = 34;
  const d =
    `M ${sx} ${sy} C ${sx} ${sy + k}, ${sx} ${laneY}, ${sx - k} ${laneY} ` +
    `L ${ex + k} ${laneY} ` +
    `C ${ex} ${laneY}, ${ex} ${ey + k}, ${ex} ${ey}`;
  return { d, mx: (sx + ex) / 2, my: laneY };
}

/**
 * Lay beats + branches out as the Command Deck session graph — a layered DAG:
 * columns by longest-path depth, rows by parent-median with collision-push (so
 * forks fan into separate rows), and edges routed through free lanes so a line
 * never runs through a card. `currentId` marks the run cursor. Pure.
 */
export function layoutGraph(beats: Beat[], currentId: string | undefined): GraphView {
  const idx = new Map(beats.map((b, i) => [b.id, i] as const));
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const byTitle = new Map(beats.map((b) => [norm(b.title), b] as const));

  // 1. Nodes (beats + synthetic terminal cards) + raw adjacency.
  const meta = new Map<string, Omit<GraphNode, 'x' | 'y' | 'w' | 'h'>>();
  for (const b of beats) {
    meta.set(b.id, {
      id: b.id,
      kind: 'beat',
      beatId: b.id,
      type: b.type,
      title: b.title,
      mins: b.mins,
      status: b.status,
      optional: b.optional,
      cursor: b.id === currentId,
    });
  }
  // Edges are explicit: every branch is an arrow. A branch with a condition is a
  // labelled fork; a bare branch (no condition) is a plain sequential arrow; a
  // branch to an earlier beat is a loop-back. There is NO implicit positional
  // chaining — a freshly-added, unwired beat stays disconnected (see tray below).
  const raw: RawEdge[] = [];
  beats.forEach((b, i) => {
    const cursor = b.id === currentId;
    for (const br of b.branches) {
      const to = br.to.trim();
      const target = to ? byTitle.get(norm(to)) : undefined;
      if (target && target.id !== b.id) {
        const back = (idx.get(target.id) ?? 0) < i;
        const cond = br.cond.trim();
        raw.push({
          id: `fork:${br.id}`,
          from: b.id,
          to: target.id,
          kind: back ? 'loop' : cond ? 'fork' : 'seq',
          label: cond || (back ? br.to : undefined),
          cursor,
        });
      } else if (to && !target) {
        const tid = `term:${b.id}:${br.id}`;
        meta.set(tid, { id: tid, kind: 'terminal', srcId: b.id, branchId: br.id, type: 'terminal', title: br.to, cursor: false });
        raw.push({ id: `term:${br.id}`, from: b.id, to: tid, kind: 'terminal', label: br.cond || br.to, cursor });
      }
    }
  });

  const ids = [...meta.keys()];
  const rank = (id: string) => idx.get(id) ?? 10000; // beats keep order; terminals last

  // Unwired beats (no edge touches them) don't join the DAG — they drop into a
  // floating tray so adding a beat never rearranges or auto-connects the graph.
  const connected = new Set<string>();
  for (const e of raw) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const cids = ids.filter((id) => connected.has(id));
  const isolated = ids.filter((id) => !connected.has(id));

  const fwd = raw.filter((e) => e.kind !== 'loop');
  const outOf = new Map<string, string[]>(cids.map((id) => [id, []]));
  const parentsOf = new Map<string, string[]>(cids.map((id) => [id, []]));
  const indeg = new Map<string, number>(cids.map((id) => [id, 0]));
  for (const e of fwd) {
    outOf.get(e.from)!.push(e.to);
    parentsOf.get(e.to)!.push(e.from);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }

  // 2. Columns — Kahn topo order, then longest-path relaxation (connected only).
  const indeg2 = new Map(indeg);
  const queue = cids.filter((id) => indeg2.get(id) === 0).sort((a, b) => rank(a) - rank(b));
  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of outOf.get(u)!) {
      indeg2.set(v, indeg2.get(v)! - 1);
      if (indeg2.get(v) === 0) queue.push(v);
    }
  }
  for (const id of cids) if (!topo.includes(id)) topo.push(id); // any cycle remnants
  const col = new Map<string, number>(cids.map((id) => [id, 0]));
  for (const u of topo) for (const v of outOf.get(u)!) col.set(v, Math.max(col.get(v)!, col.get(u)! + 1));

  // 3. Rows — per column, place each node near its parents' median row, pushing
  //    off collisions. Forks whose children share a column fan out to ±rows.
  const row = new Map<string, number>();
  const occ = new Map<number, Set<number>>();
  const maxCol = Math.max(0, ...col.values());
  const byCol = new Map<number, string[]>();
  for (const id of cids) (byCol.get(col.get(id)!) ?? byCol.set(col.get(id)!, []).get(col.get(id)!)!).push(id);
  for (let c = 0; c <= maxCol; c++) {
    const set = occ.get(c) ?? occ.set(c, new Set()).get(c)!;
    const list = (byCol.get(c) ?? []).slice().sort((a, b) => rank(a) - rank(b));
    for (const id of list) {
      const prows = parentsOf.get(id)!.map((p) => row.get(p)).filter((r): r is number => r !== undefined);
      const desired = prows.length ? Math.round(prows.reduce((a, b) => a + b, 0) / prows.length) : 0;
      let r = desired;
      for (let k = 1; set.has(r); k++) r = desired + (k % 2 ? Math.ceil(k / 2) : -Math.ceil(k / 2));
      set.add(r);
      row.set(id, r);
    }
  }

  // 4. Reserve lane rows for edges that need them, BEFORE sizing the canvas —
  //    so a long-edge arc or a loop-back can never draw outside the bounds.
  const nodeMin = Math.min(0, ...row.values());
  const nodeMax = Math.max(0, ...row.values());
  const laneRowOf = new Map<string, number>();
  let laneMin = nodeMin;
  let laneMax = nodeMax;
  for (const e of raw) {
    if (e.kind === 'loop') continue;
    const sc = col.get(e.from)!;
    const dc = col.get(e.to)!;
    if (dc - sc <= 1) continue;
    const near = Math.min(row.get(e.from)!, row.get(e.to)!);
    const cand = [near, near - 1, near + 1, near - 2, near + 2, nodeMin - 1, nodeMax + 1, nodeMax + 2];
    let laneRow = nodeMax + 1;
    for (const r of cand) {
      let free = true;
      for (let c = sc + 1; c < dc; c++) if (occ.get(c)?.has(r)) { free = false; break; }
      if (free) { laneRow = r; break; }
    }
    for (let c = sc + 1; c < dc; c++) occ.get(c)?.add(laneRow); // don't reuse this lane
    laneRowOf.set(e.id, laneRow);
    laneMin = Math.min(laneMin, laneRow);
    laneMax = Math.max(laneMax, laneRow);
  }

  // Loop-backs ride a shallow lane just under the columns they span (not the
  // canvas floor), so a rewind edge stays a tidy local dip, never a giant U.
  const loopLaneOf = new Map<string, number>();
  for (const e of raw) {
    if (e.kind !== 'loop') continue;
    const lo = Math.min(col.get(e.from)!, col.get(e.to)!);
    const hi = Math.max(col.get(e.from)!, col.get(e.to)!);
    let lane = Math.max(row.get(e.from)!, row.get(e.to)!);
    for (let c = lo; c <= hi; c++) for (const r of occ.get(c) ?? []) lane = Math.max(lane, r);
    lane += 1;
    while (Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).some((c) => occ.get(c)?.has(lane))) lane++;
    for (let c = lo; c <= hi; c++) (occ.get(c) ?? occ.set(c, new Set()).get(c)!).add(lane);
    loopLaneOf.set(e.id, lane);
    laneMax = Math.max(laneMax, lane);
  }

  // 5. Absolute geometry, offset so every row (incl. lanes) is >= 0.
  const gMin = Math.min(0, laneMin);
  const gMax = laneMax;
  const xOf = (c: number) => G_PADX + c * G_COLW;
  const yOf = (r: number) => G_PADY + (r - gMin) * G_ROWH;
  // Floating tray: unwired beats sit in their own row below (or above, if the
  // graph is empty) the connected graph — a clear "unplaced" holding area.
  const trayRow = cids.length ? gMax + 2 : 0;
  const trayY = yOf(trayRow);
  const nodes: GraphNode[] = ids.map((id) => {
    const base = { ...meta.get(id)!, w: G_W, h: G_H };
    if (connected.has(id)) return { ...base, x: xOf(col.get(id)!), y: yOf(row.get(id)!) };
    return { ...base, x: G_PADX + isolated.indexOf(id) * G_COLW, y: trayY };
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const baseH = G_PADY + (gMax - gMin) * G_ROWH + G_H + G_PADY;
  const height = isolated.length ? Math.max(baseH, trayY + G_H + G_PADY) : baseH;

  // 6. Edges — route by span so nothing crosses a card or leaves the canvas.
  const edges: GraphEdge[] = raw.map((e) => {
    const s = nodeById.get(e.from)!;
    const d = nodeById.get(e.to)!;
    const sc = col.get(e.from)!;
    const dc = col.get(e.to)!;

    if (e.kind === 'loop') {
      const laneY = yOf(loopLaneOf.get(e.id)!) + G_H / 2;
      const p = loopPath(s.x + G_W / 2, s.y + G_H, d.x + G_W / 2, d.y + G_H, laneY);
      return toEdge(e, p);
    }

    const sx = s.x + G_W;
    const sy = s.y + G_H / 2;
    const ex = d.x;
    const ey = d.y + G_H / 2;

    if (dc - sc <= 1) return toEdge(e, curve(sx, sy, ex, ey));
    return toEdge(e, lanePath(sx, sy, ex, ey, yOf(laneRowOf.get(e.id)!) + G_H / 2));
  });

  const width = nodes.reduce((mx, n) => Math.max(mx, n.x + n.w), 0) + G_PADX;
  return { nodes, edges, width, height };
}

/** Assemble a GraphEdge from its raw form + computed geometry. */
function toEdge(e: RawEdge, p: { d: string; mx: number; my: number }): GraphEdge {
  return { id: e.id, from: e.from, to: e.to, d: p.d, label: e.label, kind: e.kind, cursor: e.cursor, lx: p.mx, ly: p.my };
}

/** Count of open vs. resolved threads, for the header tally. */
export function threadTally(threads: Thread[]): { open: number; resolved: number } {
  let open = 0;
  let resolved = 0;
  for (const t of threads) {
    if (t.resolved) resolved++;
    else open++;
  }
  return { open, resolved };
}
