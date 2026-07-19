import { describe, it, expect } from 'vitest';
import { buildGraph, layoutGraph } from './graph';
import type { Page } from './logic';
import type { LocalizedText } from '../../lib/loc';

const page = (id: string, slug: string, body: LocalizedText, extra: Partial<Page> = {}): Page => ({
  id,
  slug,
  kind: 'concept',
  title: { en: slug },
  body,
  aliases: [],
  tags: [],
  playerSafe: false,
  updatedAt: 1,
  ...extra,
});

describe('buildGraph', () => {
  it('emits one edge per resolved link and lists every page as a node', () => {
    const pages = [
      page('a', 'alpha', 'See [[beta]].'),
      page('b', 'beta', 'Nothing here.'),
    ];
    const g = buildGraph(pages);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(g.edges).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('drops dangling links (no resolvable target)', () => {
    const g = buildGraph([page('a', 'alpha', 'See [[nowhere]].')]);
    expect(g.edges).toEqual([]);
  });

  it('drops self-loops', () => {
    const g = buildGraph([page('a', 'alpha', 'I am [[alpha]].')]);
    expect(g.edges).toEqual([]);
  });

  it('de-duplicates parallel A->B links', () => {
    const g = buildGraph([page('a', 'alpha', 'See [[beta]] and again [[Beta]].'), page('b', 'beta', '')]);
    expect(g.edges).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('keeps both directions of a bidirectional pair as two edges', () => {
    const g = buildGraph([
      page('a', 'alpha', 'See [[beta]].'),
      page('b', 'beta', 'See [[alpha]].'),
    ]);
    expect(g.edges).toContainEqual({ from: 'a', to: 'b' });
    expect(g.edges).toContainEqual({ from: 'b', to: 'a' });
    expect(g.edges).toHaveLength(2);
  });

  it('resolves links across both locale bodies', () => {
    const pages = [
      page('a', 'alpha', { en: 'See [[beta]].', pl: 'Zobacz [[gamma]].' }),
      page('b', 'beta', ''),
      page('c', 'gamma', ''),
    ];
    const g = buildGraph(pages);
    expect(g.edges).toContainEqual({ from: 'a', to: 'b' });
    expect(g.edges).toContainEqual({ from: 'a', to: 'c' });
  });
});

describe('layoutGraph', () => {
  const nodes = [
    { id: 'a', slug: 'alpha', kind: 'place' as const },
    { id: 'b', slug: 'beta', kind: 'person' as const },
    { id: 'c', slug: 'gamma', kind: 'item' as const },
  ];
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
  ];

  it('is deterministic — same input yields identical output', () => {
    const one = layoutGraph(nodes, edges, { w: 800, h: 600 });
    const two = layoutGraph(nodes, edges, { w: 800, h: 600 });
    expect([...one.entries()]).toEqual([...two.entries()]);
  });

  it('keeps every node inside [0,w] x [0,h]', () => {
    const w = 640;
    const h = 480;
    const pos = layoutGraph(nodes, edges, { w, h });
    for (const { x, y } of pos.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(h);
    }
  });

  it('places the most-connected node at the centre', () => {
    const pos = layoutGraph(nodes, edges, { w: 800, h: 600 });
    // 'a' has degree 2 (two out-edges); it should be the hub at the centre.
    expect(pos.get('a')).toEqual({ x: 400, y: 300 });
  });

  it('handles trivial sizes without throwing (single + empty)', () => {
    expect(layoutGraph([], [], { w: 100, h: 100 }).size).toBe(0);
    const one = layoutGraph([nodes[0]], [], { w: 100, h: 100 });
    expect(one.get('a')).toEqual({ x: 50, y: 50 });
  });
});
