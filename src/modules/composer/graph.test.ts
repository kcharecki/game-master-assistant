import { describe, it, expect } from 'vitest';
import {
  emptyGraph,
  addNode,
  removeNode,
  connect,
  disconnect,
  evaluateGraph,
  cloneGraph,
  type Graph,
} from './graph';
import type { PublicNpc } from '../npcs/public';
import { publicView } from '../npcs/public';
import type { Npc } from '../npcs/store.svelte';

function lookup(map: Record<string, PublicNpc>) {
  return (id: string) => map[id];
}

describe('evaluateGraph', () => {
  it('returns null when there is no grid sink', () => {
    const g = addNode(emptyGraph(), 'text');
    expect(evaluateGraph(g, lookup({}))).toBeNull();
  });

  it('returns null when the grid has no connected sources', () => {
    const g = addNode(emptyGraph(), 'grid');
    expect(evaluateGraph(g, lookup({}))).toBeNull();
  });

  it('orders cells by slot and resolves text + image nodes', () => {
    let g: Graph = emptyGraph();
    g = addNode(g, 'grid', 300, 10);
    g = addNode(g, 'text', 10, 10);
    g = addNode(g, 'image', 10, 120);
    const grid = g.nodes.find((n) => n.kind === 'grid')!;
    const text = g.nodes.find((n) => n.kind === 'text')!;
    const image = g.nodes.find((n) => n.kind === 'image')!;
    g = { ...g, nodes: g.nodes.map((n) =>
      n.id === text.id ? { ...n, title: 'T', body: 'B' } : n.id === image.id ? { ...n, src: 'http://x/y.png', caption: 'cap' } : n
    ) };
    // image into slot 0, text into slot 1 — output must follow slot order.
    g = connect(g, image.id, grid.id, 0);
    g = connect(g, text.id, grid.id, 1);

    const out = evaluateGraph(g, lookup({}));
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('grid');
    expect(out!.cells).toEqual([
      { kind: 'image', src: 'http://x/y.png', caption: 'cap' },
      { kind: 'text', title: 'T', body: 'B' },
    ]);
  });

  it('clamps cols into 1..6', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'text');
    const text = g.nodes.find((n) => n.kind === 'text')!;
    g = { ...g, nodes: g.nodes.map((n) => (n.id === grid.id ? { ...n, cols: 99 } : n)) };
    g = connect(g, text.id, grid.id, 0);
    const out = evaluateGraph(g, lookup({}))!;
    expect(out.cols).toBeLessThanOrEqual(6);
    expect(out.cols).toBeGreaterThanOrEqual(1);
  });

  it('npc node with a portrait becomes an image cell using portraitId', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'npc');
    const npcNode = g.nodes.find((n) => n.kind === 'npc')!;
    g = { ...g, nodes: g.nodes.map((n) => (n.id === npcNode.id ? { ...n, npcId: 'n1' } : n)) };
    g = connect(g, npcNode.id, grid.id, 0);

    const pub: PublicNpc = { name: 'Mara', role: 'Archivist', portraitId: 'asset-9' };
    const out = evaluateGraph(g, lookup({ n1: pub }))!;
    expect(out.cells[0]).toEqual({ kind: 'image', assetId: 'asset-9', caption: 'Mara — Archivist' });
  });

  it('npc node without a portrait becomes a text cell', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'npc');
    const npcNode = g.nodes.find((n) => n.kind === 'npc')!;
    g = { ...g, nodes: g.nodes.map((n) => (n.id === npcNode.id ? { ...n, npcId: 'n1' } : n)) };
    g = connect(g, npcNode.id, grid.id, 0);

    const pub: PublicNpc = { name: 'Eli', role: 'Harbormaster', blurb: 'gruff' };
    const out = evaluateGraph(g, lookup({ n1: pub }))!;
    expect(out.cells[0]).toEqual({ kind: 'text', title: 'Eli', body: 'Harbormaster — gruff' });
  });

  // PRIVACY: an NPC node must only carry publicView fields onto the air.
  it('PRIVACY: npc node never leaks gmNotes or equipment into a cell', () => {
    const npc: Npc = {
      id: 'n1',
      name: 'Spy',
      role: 'Informant',
      disposition: 'neutral',
      publicBlurb: 'shifty',
      gmNotes: 'SECRET betrayal at midnight',
      equipment: [{ id: 'e1', name: 'hidden dagger' }],
    };
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'npc');
    const npcNode = g.nodes.find((n) => n.kind === 'npc')!;
    g = { ...g, nodes: g.nodes.map((n) => (n.id === npcNode.id ? { ...n, npcId: 'n1' } : n)) };
    g = connect(g, npcNode.id, grid.id, 0);

    const out = evaluateGraph(g, lookup({ n1: publicView(npc) }))!;
    const blob = JSON.stringify(out);
    expect(blob).not.toContain('SECRET');
    expect(blob).not.toContain('betrayal');
    expect(blob).not.toContain('hidden dagger');
    expect(out.cells[0]).toEqual({ kind: 'text', title: 'Spy', body: 'Informant — shifty' });
  });
});

describe('graph helpers', () => {
  it('removeNode cascades its edges', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'text');
    const text = g.nodes.find((n) => n.kind === 'text')!;
    g = connect(g, text.id, grid.id, 0);
    expect(g.edges).toHaveLength(1);
    g = removeNode(g, text.id);
    expect(g.nodes.find((n) => n.id === text.id)).toBeUndefined();
    expect(g.edges).toHaveLength(0);
  });

  it('connect replaces an edge occupying the same slot', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'text');
    g = addNode(g, 'image');
    const text = g.nodes.find((n) => n.kind === 'text')!;
    const image = g.nodes.find((n) => n.kind === 'image')!;
    g = connect(g, text.id, grid.id, 0);
    g = connect(g, image.id, grid.id, 0);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].from).toBe(image.id);
  });

  it('refuses to connect a node to itself or wire into a non-grid node', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'text');
    const text = g.nodes.find((n) => n.kind === 'text')!;
    // wiring into a text node (not a grid) is rejected
    const before = g.edges.length;
    g = connect(g, text.id, text.id, 0);
    expect(g.edges).toHaveLength(before);
    // grid can't be a source
    g = connect(g, grid.id, grid.id, 0);
    expect(g.edges).toHaveLength(before);
  });

  it('disconnect removes an edge by id', () => {
    let g = addNode(emptyGraph(), 'grid');
    const grid = g.nodes[0];
    g = addNode(g, 'text');
    const text = g.nodes.find((n) => n.kind === 'text')!;
    g = connect(g, text.id, grid.id, 0);
    const edgeId = g.edges[0].id;
    g = disconnect(g, edgeId);
    expect(g.edges).toHaveLength(0);
  });
});

describe('cloneGraph', () => {
  function wired(): Graph {
    let g: Graph = emptyGraph();
    g = addNode(g, 'grid', 300, 10);
    g = addNode(g, 'text', 10, 10);
    g = addNode(g, 'image', 10, 120);
    const grid = g.nodes.find((n) => n.kind === 'grid')!;
    const text = g.nodes.find((n) => n.kind === 'text')!;
    const image = g.nodes.find((n) => n.kind === 'image')!;
    g = {
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === text.id
          ? { ...n, title: 'T', body: 'B' }
          : n.id === image.id
            ? { ...n, src: 'http://x/y.png', caption: 'cap' }
            : n
      ),
    };
    g = connect(g, image.id, grid.id, 0);
    g = connect(g, text.id, grid.id, 1);
    return g;
  }

  it('assigns fresh ids but preserves structure and wiring', () => {
    const orig = wired();
    const clone = cloneGraph(orig);

    expect(clone.nodes).toHaveLength(orig.nodes.length);
    expect(clone.edges).toHaveLength(orig.edges.length);

    // All node + edge ids are new.
    const origNodeIds = new Set(orig.nodes.map((n) => n.id));
    for (const n of clone.nodes) expect(origNodeIds.has(n.id)).toBe(false);
    const origEdgeIds = new Set(orig.edges.map((e) => e.id));
    for (const e of clone.edges) expect(origEdgeIds.has(e.id)).toBe(false);

    // Every cloned edge.from points at a cloned node, slot index preserved.
    const cloneNodeIds = new Set(clone.nodes.map((n) => n.id));
    for (const e of clone.edges) expect(cloneNodeIds.has(e.from)).toBe(true);
    expect(clone.edges.map((e) => e.toSlot).sort()).toEqual(
      orig.edges.map((e) => e.toSlot).sort()
    );
  });

  it('produces an independent copy (mutating clone leaves original intact)', () => {
    const orig = wired();
    const clone = cloneGraph(orig);
    clone.nodes[0].x = 999;
    clone.nodes.push({ id: 'extra', kind: 'text', x: 0, y: 0 });
    expect(orig.nodes[0].x).not.toBe(999);
    expect(orig.nodes).toHaveLength(3);
  });

  it('evaluates to the same cell shape as the original', () => {
    const orig = wired();
    const clone = cloneGraph(orig);
    const a = evaluateGraph(orig, lookup({}))!;
    const b = evaluateGraph(clone, lookup({}))!;
    expect(b.kind).toBe(a.kind);
    expect(b.cols).toBe(a.cols);
    expect(b.cells).toEqual(a.cells);
  });
});
