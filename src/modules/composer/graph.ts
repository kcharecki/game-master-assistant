import type { GridCell } from '../../lib/types';
import type { PublicNpc } from '../npcs/public';
import { clampCols } from '../../broadcast/grid';

export type NodeKind = 'npc' | 'image' | 'text' | 'grid';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  // npc source config:
  npcId?: string;
  // image source config:
  assetId?: string;
  src?: string;
  caption?: string;
  // text source config:
  title?: string;
  body?: string;
  // grid sink config:
  cols?: number;
}

/** A wire from a source node's output into the grid sink's input slot. */
export interface Edge {
  id: string;
  from: string;
  toSlot: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: Edge[];
}

export type GridPayload = { kind: 'grid'; cols: number; cells: GridCell[] };

export function emptyGraph(): Graph {
  return { nodes: [], edges: [] };
}

/** The single grid sink node, if present. */
export function gridNode(graph: Graph): GraphNode | undefined {
  return graph.nodes.find((n) => n.kind === 'grid');
}

/**
 * Convert a source node to a player-safe grid cell.
 *
 * NPC representation (consistent): if the NPC's publicView has a portraitId we
 * emit an IMAGE cell (assetId = portraitId, caption = "name — role"); otherwise
 * a TEXT cell {title:name, body: role + blurb}. Only publicView fields are read,
 * so gmNotes/equipment can never reach a payload.
 */
function nodeToCell(
  node: GraphNode,
  npcLookup: (id: string) => PublicNpc | undefined
): GridCell | null {
  if (node.kind === 'npc') {
    if (!node.npcId) return null;
    const pub = npcLookup(node.npcId);
    if (!pub) return null;
    if (pub.portraitId) {
      const caption = pub.role ? `${pub.name} — ${pub.role}` : pub.name;
      return { kind: 'image', assetId: pub.portraitId, caption };
    }
    const body = [pub.role, pub.blurb].filter(Boolean).join(' — ');
    return { kind: 'text', title: pub.name, body };
  }
  if (node.kind === 'image') {
    const cell: GridCell = { kind: 'image' };
    if (node.assetId) cell.assetId = node.assetId;
    if (node.src) cell.src = node.src;
    if (node.caption) cell.caption = node.caption;
    return cell;
  }
  if (node.kind === 'text') {
    const cell: GridCell = { kind: 'text' };
    if (node.title) cell.title = node.title;
    if (node.body) cell.body = node.body;
    return cell;
  }
  return null;
}

/**
 * Evaluate the graph into a grid broadcast payload, or null if there is no
 * grid sink or no resolvable connected sources. Cells are ordered by toSlot.
 */
export function evaluateGraph(
  graph: Graph,
  npcLookup: (id: string) => PublicNpc | undefined
): GridPayload | null {
  const sink = gridNode(graph);
  if (!sink) return null;

  const edges = graph.edges
    .filter((e) => graph.nodes.some((n) => n.id === e.from && n.kind !== 'grid'))
    .slice()
    .sort((a, b) => a.toSlot - b.toSlot);

  const cells: GridCell[] = [];
  for (const e of edges) {
    const src = graph.nodes.find((n) => n.id === e.from);
    if (!src) continue;
    const cell = nodeToCell(src, npcLookup);
    if (cell) cells.push(cell);
  }

  if (cells.length === 0) return null;
  return { kind: 'grid', cols: clampCols(sink.cols ?? 2, cells.length), cells };
}

export function addNode(graph: Graph, kind: NodeKind, x = 20, y = 20): Graph {
  const node: GraphNode = { id: crypto.randomUUID(), kind, x, y };
  if (kind === 'grid') node.cols = 2;
  return { ...graph, nodes: [...graph.nodes, node] };
}

/** Remove a node and cascade-drop any edges touching it. */
export function removeNode(graph: Graph, id: string): Graph {
  return {
    nodes: graph.nodes.filter((n) => n.id !== id),
    edges: graph.edges.filter((e) => e.from !== id),
  };
}

export function moveNode(graph: Graph, id: string, x: number, y: number): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
  };
}

export function updateNode(
  graph: Graph,
  id: string,
  patch: Partial<Omit<GraphNode, 'id' | 'kind'>>
): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  };
}

/**
 * Wire a source node into the grid sink at a slot. One edge per slot (replaces
 * an occupied slot). Rejects: missing grid sink, self/grid sources, or wiring
 * into a non-grid node.
 */
export function connect(graph: Graph, from: string, gridId: string, toSlot: number): Graph {
  const sink = graph.nodes.find((n) => n.id === gridId);
  if (!sink || sink.kind !== 'grid') return graph;
  const src = graph.nodes.find((n) => n.id === from);
  if (!src || src.kind === 'grid' || from === gridId) return graph;

  const edge: Edge = { id: crypto.randomUUID(), from, toSlot };
  const kept = graph.edges.filter((e) => e.toSlot !== toSlot);
  return { ...graph, edges: [...kept, edge] };
}

export function disconnect(graph: Graph, edgeId: string): Graph {
  return { ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) };
}

/**
 * Deep-clone a graph, assigning a fresh id to every node and remapping all
 * edges so each `edge.from` (and thus the wiring into the grid sink) points at
 * the cloned node, preserving every connection and slot index. The clone shares
 * no object references with the original, so mutating one never affects the other.
 */
export function cloneGraph(graph: Graph): Graph {
  const idMap = new Map<string, string>();
  const nodes = graph.nodes.map((n) => {
    const id = crypto.randomUUID();
    idMap.set(n.id, id);
    return { ...n, id };
  });
  const edges = graph.edges.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    from: idMap.get(e.from) ?? e.from,
  }));
  return { nodes, edges };
}

export function serialize(graph: Graph): string {
  return JSON.stringify(graph);
}

export function deserialize(raw: string): Graph {
  try {
    const g = JSON.parse(raw) as Partial<Graph>;
    return {
      nodes: Array.isArray(g.nodes) ? g.nodes : [],
      edges: Array.isArray(g.edges) ? g.edges : [],
    };
  } catch {
    return emptyGraph();
  }
}
