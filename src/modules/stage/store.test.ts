import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/db', () => ({
  kvGet: vi.fn().mockResolvedValue(undefined),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../reveal/bus-actions', () => ({ putOnAir: vi.fn() }));
vi.mock('../../lib/stores/toast.svelte', () => ({
  toast: { undoable: vi.fn() },
}));

import { stage } from './store.svelte';
import { newBeat, resolveTiles } from './board';

beforeEach(() => {
  stage.onAir = null;
  stage.mode = 'plan';
  stage.live = false;
  stage.air = null;
  stage.activeVariantId = null;
  const b = newBeat('Beat 1');
  stage.state = { beats: [b], cursorId: b.id };
  stage.armedId = b.id;
  stage.armedVariantId = null;
});

describe('variant-aware tile ops', () => {
  it('edits a base tile inside a variant as a delta, leaving the base intact', () => {
    const base = stage.addTile('text', { title: 'Base' });
    stage.addVariant('Night');
    stage.patchTile(base.id, { title: 'Night title' });

    // base tile untouched
    expect(stage.state.beats[0].tiles[0].title).toBe('Base');
    // delta recorded on the variant
    expect(stage.state.beats[0].variants[0].patches[base.id].title).toBe('Night title');
    // effective (variant) view reflects the patch
    expect(stage.tiles.find((t) => t.id === base.id)!.title).toBe('Night title');

    // switching back to base shows the original
    stage.setActiveVariant(null);
    expect(stage.tiles.find((t) => t.id === base.id)!.title).toBe('Base');
  });

  it('adds a tile only to the active variant', () => {
    stage.addTile('text', { title: 'Base' });
    stage.addVariant('Night');
    const added = stage.addTile('text', { title: 'Extra' });

    expect(stage.state.beats[0].variants[0].added.some((t) => t.id === added.id)).toBe(true);
    expect(stage.state.beats[0].tiles).toHaveLength(1); // base unchanged
    expect(stage.tiles).toHaveLength(2); // base + added, in the variant view
  });

  it('removing a base tile inside a variant records it as removed, not deleted', () => {
    const base = stage.addTile('text', { title: 'Base' });
    stage.addVariant('Night');
    stage.removeTile(base.id);

    expect(stage.state.beats[0].variants[0].removed).toContain(base.id);
    expect(stage.state.beats[0].tiles).toHaveLength(1); // base intact
    expect(stage.tiles.find((t) => t.id === base.id)).toBeUndefined();
  });
});

describe('duplicateBeat', () => {
  it('remaps variant patches/removed to the copy\'s new tile ids', () => {
    const kept = stage.addTile('text', { title: 'Kept' });
    const droppedFromVariant = stage.addTile('text', { title: 'Dropped' });
    stage.addVariant('Night');
    stage.patchTile(kept.id, { title: 'Kept — Night' });
    stage.removeTile(droppedFromVariant.id);
    stage.setActiveVariant(null);

    const srcVariantId = stage.state.beats[0].variants[0].id;
    const copy = stage.duplicateBeat(stage.state.beats[0].id);

    // Copy's base tiles are fresh ids, distinct from the source's.
    const srcTileIds = new Set(stage.beatById(stage.state.beats[0].id)!.tiles.map((t) => t.id));
    for (const t of copy.tiles) expect(srcTileIds.has(t.id)).toBe(false);

    const copyKept = copy.tiles.find((t) => t.title === 'Kept')!;
    const copyVariant = copy.variants[0];

    // Patch key was remapped to the copy's tile id, not the old (stale) one.
    expect(copyVariant.patches[copyKept.id]?.title).toBe('Kept — Night');
    expect(copyVariant.patches[kept.id]).toBeUndefined();

    // Removed entry was remapped too — resolving the variant drops the copy's
    // corresponding tile, not silently keeping it (or matching nothing).
    expect(copyVariant.removed).not.toContain(droppedFromVariant.id);
    expect(copyVariant.removed).toHaveLength(1);

    // End-to-end: resolving the copy's variant reflects both the patch and the
    // removal on the *copy's* tiles.
    const resolved = resolveTiles(copy, copyVariant.id);
    expect(resolved.find((t) => t.title === 'Kept — Night')).toBeDefined();
    expect(resolved.some((t) => t.title === 'Dropped')).toBe(false);

    // Sanity: the source beat's own variant is untouched (still keyed by original ids).
    const srcVariant = stage.beatById(stage.state.beats[0].id)!.variants[0];
    expect(srcVariant.id).toBe(srcVariantId);
    expect(srcVariant.patches[kept.id]?.title).toBe('Kept — Night');
  });
});

describe('RUN cockpit — arm / take', () => {
  it('TAKE airs the armed beat and advances the playhead', () => {
    const b1 = stage.state.beats[0];
    stage.addTile('text', { title: 'A' });
    const b2 = stage.addBeat('Beat 2');
    stage.addTile('text', { title: 'B' });

    const onAir = vi.fn();
    stage.onAir = onAir;
    stage.setMode('run');
    stage.arm(b1.id);
    stage.take();

    expect(onAir).toHaveBeenCalledTimes(1);
    expect(stage.air?.beatId).toBe(b1.id);
    expect(stage.cursorId).toBe(b1.id); // playhead moved to what aired
    expect(stage.armedId).toBe(b2.id); // next beat auto-armed
  });

  it('cycles the armed variant base → variant → base', () => {
    const b1 = stage.state.beats[0];
    stage.addTile('text', { title: 'A' });
    stage.addVariant('Night'); // adds to b1, makes it active in PLAN
    stage.setActiveVariant(null);
    const vId = stage.state.beats[0].variants[0].id;

    stage.setMode('run');
    stage.arm(b1.id);
    expect(stage.armedVariantId).toBeNull();
    stage.cycleArmedVariant();
    expect(stage.armedVariantId).toBe(vId);
    stage.cycleArmedVariant();
    expect(stage.armedVariantId).toBeNull();
  });
});

describe('forks', () => {
  it('adds and retargets a fork, and drops it when its target beat is removed', () => {
    const b1 = stage.state.beats[0];
    const b2 = stage.addBeat('Rail');
    const f = stage.addFork(b1.id, 'open the cabinet')!;
    stage.updateFork(b1.id, f.id, { targetBeatId: b2.id });

    expect(stage.beatById(b1.id)!.forks[0].targetBeatId).toBe(b2.id);

    stage.removeBeat(b2.id);
    expect(stage.beatById(b1.id)!.forks[0].targetBeatId).toBeUndefined();
  });
});
