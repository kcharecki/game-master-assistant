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
  serialize,
  deserialize,
} from './graph';

const KV_KEY = 'composerGraph';

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

/** Reactive node-graph for the Broadcast Composer. */
class ComposerStore {
  graph = $state<Graph>(seed());

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

  /** Live grid payload, or null when nothing is connected. */
  get preview(): GridPayload | null {
    return evaluateGraph(this.graph, this.npcLookup);
  }

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

  persist(): void {
    void kvSet(KV_KEY, serialize($state.snapshot(this.graph)));
  }

  async load(): Promise<void> {
    const saved = await kvGet<string>(KV_KEY);
    if (saved) this.graph = deserialize(saved);
  }
}

export const composer = new ComposerStore();
