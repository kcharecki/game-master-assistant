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
    expect(kvSet).toHaveBeenCalledWith('composerGraph', expect.any(String));
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
