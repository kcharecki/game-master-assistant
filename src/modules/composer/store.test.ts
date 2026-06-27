import { describe, it, expect, beforeEach, vi } from 'vitest';

const kvSet = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: (...args: unknown[]) => kvSet(...args),
}));

import { composer } from './store.svelte';

describe('ComposerStore', () => {
  beforeEach(() => {
    kvSet.mockClear();
    // reset to a single grid sink, no other nodes
    composer.graph = { nodes: [{ id: 'g', kind: 'grid', x: 0, y: 0, cols: 2 }], edges: [] };
  });

  it('seeds with a grid sink available', () => {
    expect(composer.gridNode).toBeDefined();
    expect(composer.gridNode!.kind).toBe('grid');
  });

  it('adds a node and persists a serialized string', () => {
    composer.add('text', 10, 20);
    const text = composer.nodes.find((n) => n.kind === 'text');
    expect(text).toBeDefined();
    expect(kvSet).toHaveBeenCalledWith('composerViews', expect.any(String));
  });

  it('connects a source into the grid and previews a payload', () => {
    composer.add('text', 10, 20);
    const text = composer.nodes.find((n) => n.kind === 'text')!;
    composer.patch(text.id, { title: 'Hi', body: 'there' });
    composer.connect(text.id, 'g', 0);
    expect(composer.edges).toHaveLength(1);
    const out = composer.preview;
    expect(out).not.toBeNull();
    expect(out!.cells[0]).toEqual({ kind: 'text', title: 'Hi', body: 'there' });
  });

  it('preview is null with no connected sources', () => {
    expect(composer.preview).toBeNull();
  });
});

describe('ComposerStore views', () => {
  beforeEach(() => {
    kvSet.mockClear();
    const v = { id: 'v1', name: 'View 1', graph: { nodes: [], edges: [] } };
    composer.state = { views: [v], activeId: 'v1' };
  });

  it('addView appends and makes the new view active', () => {
    const before = composer.views.length;
    const v = composer.addView('Combat');
    expect(composer.views).toHaveLength(before + 1);
    expect(composer.activeId).toBe(v.id);
    expect(composer.active.name).toBe('Combat');
  });

  it('mutators operate on the active view only', () => {
    composer.addView('B'); // active is B now, empty
    composer.add('grid', 0, 0);
    const aId = composer.views[0].id;
    composer.setActive(aId);
    expect(composer.gridNode).toBeUndefined(); // A untouched
  });

  it('duplicateView clones the active view with fresh ids and "copy" name', () => {
    composer.add('grid', 0, 0);
    composer.add('text', 10, 10);
    const text = composer.nodes.find((n) => n.kind === 'text')!;
    const grid = composer.gridNode!;
    composer.connect(text.id, grid.id, 0);

    const origIds = new Set(composer.nodes.map((n) => n.id));
    const dup = composer.duplicateView();
    expect(dup.name).toBe('View 1 copy');
    expect(composer.activeId).toBe(dup.id);
    // cloned node ids differ but wiring preserved
    for (const n of dup.graph.nodes) expect(origIds.has(n.id)).toBe(false);
    expect(dup.graph.edges).toHaveLength(1);
    const cloneIds = new Set(dup.graph.nodes.map((n) => n.id));
    expect(cloneIds.has(dup.graph.edges[0].from)).toBe(true);
  });

  it('removeView never drops below one view', () => {
    composer.addView('B');
    const ids = composer.views.map((v) => v.id);
    composer.removeView(ids[0]);
    expect(composer.views).toHaveLength(1);
    composer.removeView(composer.views[0].id); // refuses last
    expect(composer.views).toHaveLength(1);
  });

  it('renameView updates the name', () => {
    composer.renameView('v1', 'Tavern');
    expect(composer.active.name).toBe('Tavern');
  });
});
