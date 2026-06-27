import { kvSet, kvGet } from '../../lib/db';
import { npcs } from '../npcs/store.svelte';
import { publicView, type PublicNpc } from '../npcs/public';
import {
  type Graph,
  type GraphNode,
  type Edge,
  type NodeKind,
  type GridPayload,
  addNode,
  removeNode,
  moveNode,
  updateNode,
  connect,
  disconnect,
  evaluateGraph,
  cloneGraph,
  deserialize,
} from './graph';

// Legacy single-graph key (one graph, no tabs). Migrated on load.
const LEGACY_KEY = 'composerGraph';
// New multi-view key: { views: View[]; activeId: string }.
const KV_KEY = 'composerViews';

export interface View {
  id: string;
  name: string;
  graph: Graph;
}

interface ViewsState {
  views: View[];
  activeId: string;
}

/** Starter graph: a grid sink plus one npc source, pre-wired into slot 0. */
function seed(): Graph {
  const gridId = crypto.randomUUID();
  const npcId = crypto.randomUUID();
  return {
    nodes: [
      { id: gridId, kind: 'grid', x: 380, y: 40, cols: 2 },
      { id: npcId, kind: 'npc', x: 40, y: 40 },
    ],
    edges: [{ id: crypto.randomUUID(), from: npcId, toSlot: 0 }],
  };
}

function newView(name: string, graph: Graph = seed()): View {
  return { id: crypto.randomUUID(), name, graph };
}

/** Reactive multi-view node-graph store for the Broadcast Composer. */
class ComposerStore {
  state = $state<ViewsState>({ views: [newView('View 1')], activeId: '' });

  constructor() {
    this.state.activeId = this.state.views[0].id;
  }

  // --- view collection ------------------------------------------------------
  get views(): View[] {
    return this.state.views;
  }
  get activeId(): string {
    return this.state.activeId;
  }
  get active(): View {
    return this.state.views.find((v) => v.id === this.state.activeId) ?? this.state.views[0];
  }

  /**
   * The ACTIVE view's graph. Kept as a get/set pair so existing call sites
   * (and tests) that read/assign `composer.graph` keep working unchanged.
   */
  get graph(): Graph {
    return this.active.graph;
  }
  set graph(g: Graph) {
    const v = this.active;
    v.graph = g;
  }

  setActive(id: string): void {
    if (this.state.views.some((v) => v.id === id)) {
      this.state.activeId = id;
      this.persist();
    }
  }

  addView(name?: string): View {
    const v = newView(name ?? `View ${this.state.views.length + 1}`);
    this.state.views = [...this.state.views, v];
    this.state.activeId = v.id;
    this.persist();
    return v;
  }

  /** Clone a view (default: active) with fresh node/edge ids, make it active. */
  duplicateView(id?: string): View {
    const srcId = id ?? this.state.activeId;
    const src = this.state.views.find((v) => v.id === srcId) ?? this.active;
    const v = newView(`${src.name} copy`, cloneGraph(src.graph));
    const i = this.state.views.findIndex((x) => x.id === src.id);
    const next = this.state.views.slice();
    next.splice(i + 1, 0, v);
    this.state.views = next;
    this.state.activeId = v.id;
    this.persist();
    return v;
  }

  renameView(id: string, name: string): void {
    const v = this.state.views.find((x) => x.id === id);
    if (!v) return;
    v.name = name;
    this.persist();
  }

  /** Remove a view; never drops below one view. */
  removeView(id: string): void {
    if (this.state.views.length <= 1) return;
    const i = this.state.views.findIndex((v) => v.id === id);
    if (i < 0) return;
    const next = this.state.views.filter((v) => v.id !== id);
    this.state.views = next;
    if (this.state.activeId === id) {
      this.state.activeId = next[Math.min(i, next.length - 1)].id;
    }
    this.persist();
  }

  // --- active-graph projections ---------------------------------------------
  get nodes(): GraphNode[] {
    return this.graph.nodes;
  }
  get edges(): Edge[] {
    return this.graph.edges;
  }
  get gridNode(): GraphNode | undefined {
    return this.graph.nodes.find((n) => n.kind === 'grid');
  }

  /** Player-safe NPC projection for a node, or undefined. */
  npcLookup = (id: string): PublicNpc | undefined => {
    const npc = npcs.list.find((n) => n.id === id);
    return npc ? publicView(npc) : undefined;
  };

  /** Live grid payload for the active view, or null when nothing is connected. */
  get preview(): GridPayload | null {
    return evaluateGraph(this.graph, this.npcLookup);
  }

  // --- active-graph mutators ------------------------------------------------
  add(kind: NodeKind, x = 30, y = 30): void {
    this.graph = addNode(this.graph, kind, x, y);
    this.persist();
  }

  remove(id: string): void {
    this.graph = removeNode(this.graph, id);
    this.persist();
  }

  move(id: string, x: number, y: number): void {
    this.graph = moveNode(this.graph, id, x, y);
    this.persist();
  }

  patch(id: string, patch: Partial<Omit<GraphNode, 'id' | 'kind'>>): void {
    this.graph = updateNode(this.graph, id, patch);
    this.persist();
  }

  connect(from: string, gridId: string, toSlot: number): void {
    this.graph = connect(this.graph, from, gridId, toSlot);
    this.persist();
  }

  disconnect(edgeId: string): void {
    this.graph = disconnect(this.graph, edgeId);
    this.persist();
  }

  // --- persistence ----------------------------------------------------------
  persist(): void {
    const snap = $state.snapshot(this.state) as ViewsState;
    void kvSet(KV_KEY, JSON.stringify(snap));
  }

  async load(): Promise<void> {
    const saved = await kvGet<string>(KV_KEY);
    if (saved) {
      const parsed = this.parseViews(saved);
      if (parsed) {
        this.state = parsed;
        return;
      }
    }
    // Migrate a legacy single-graph save into one view named "View 1".
    const legacy = await kvGet<string>(LEGACY_KEY);
    if (legacy) {
      const view = newView('View 1', deserialize(legacy));
      this.state = { views: [view], activeId: view.id };
      this.persist();
    }
  }

  private parseViews(raw: string): ViewsState | null {
    try {
      const obj = JSON.parse(raw) as Partial<ViewsState>;
      if (!Array.isArray(obj.views) || obj.views.length === 0) return null;
      const views: View[] = obj.views.map((v, i) => ({
        id: typeof v?.id === 'string' ? v.id : crypto.randomUUID(),
        name: typeof v?.name === 'string' ? v.name : `View ${i + 1}`,
        graph: {
          nodes: Array.isArray(v?.graph?.nodes) ? v.graph.nodes : [],
          edges: Array.isArray(v?.graph?.edges) ? v.graph.edges : [],
        },
      }));
      const activeId = views.some((v) => v.id === obj.activeId)
        ? (obj.activeId as string)
        : views[0].id;
      return { views, activeId };
    } catch {
      return null;
    }
  }
}

export const composer = new ComposerStore();
